import { MemoryManager } from '../memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../app/memory-evo/MemoryEvolutionSystem.js';
import { SkillEvolutionSystem } from '../../app/skill-evo/SkillEvolutionSystem.js';
import { LLMClient } from '../llm/LLMClient.js';
import { SkillManager } from '../skills/SkillManager.js';
import { LiteratureReviewSkill } from '../skills/impl/LiteratureReviewSkill.js';
import { LocalFileSkill } from '../skills/impl/LocalFileSkill.js';

export class ResearchAgent {
  private memoryManager: MemoryManager;
  private memoryEvo: MemoryEvolutionSystem;
  private skillEvo: SkillEvolutionSystem;
  private llm: LLMClient;
  public skillManager: SkillManager;

  constructor(
    memoryManager: MemoryManager,
    memoryEvo: MemoryEvolutionSystem,
    llm: LLMClient,
    skillManager?: SkillManager
  ) {
    this.memoryManager = memoryManager;
    this.memoryEvo = memoryEvo;
    this.llm = llm;
    this.skillManager = skillManager || new SkillManager(llm, memoryManager);
    this.skillEvo = new SkillEvolutionSystem(this.skillManager, llm);
    
    // Register Default Skills
    this.skillManager.registerSkill(new LiteratureReviewSkill());
    this.skillManager.registerSkill(new LocalFileSkill());
  }

  public async chat(
    userId: string, 
    message: string, 
    onProgress?: (type: 'token' | 'log', content: string) => void
  ): Promise<string> {
    // Helper to log and emit progress
    const log = (content: string) => {
      console.log(content);
      onProgress?.('log', content);
    };

    // 0. Intent Detection (Simple Heuristic)
    if (message.toLowerCase().includes('literature review') || message.toLowerCase().includes('search papers')) {
      const topic = message.replace(/\b(do a|perform a|literature review|search papers|about|on)\b/gi, '').trim().replace(/\s+/g, ' ');
      if (topic.length > 3) {
        log(`[Agent] Detected intent: Literature Review on "${topic}"`);
        try {
          const result = await this.skillManager.executeSkill(
            'literature_review', 
            userId, 
            { topic },
            // Custom logger to stream skill progress
            (type, content) => {
               log(`[Skill] ${content}`);
            }
          );
          return `Here is a literature review on "${topic}":\n\n${result.summary}\n\n**Sources:**\n${result.papers.map((p: any) => `- ${p.title} (${p.year})`).join('\n')}`;
        } catch (e) {
          console.error('[Agent] Skill execution failed:', e);
          // Fallback to normal chat
        }
      }
    }

    if (message.toLowerCase().includes('organize files') || message.toLowerCase().includes('move pdfs')) {
      try {
        log('[Agent] Organizing files...');
        const result = await this.skillManager.executeSkill('local_file_ops', userId, { operation: 'organize' });
        return `I have organized your PDF files into a 'papers' folder. Moved ${result.moved} files.`;
      } catch (e) {
        console.error('[Agent] Skill execution failed:', e);
      }
    }

    // 0.5. Skill Evolution Check (New)
    // For MVP, we trigger this if the user explicitly asks for a new ability
    if (message.toLowerCase().includes('can you') || message.toLowerCase().includes('how do i')) {
       log('[Agent] Checking if I need to learn a new skill...');
       // Attempt to evolve a skill if none exists
       // This is a simplified logic. In production, we'd check if any existing skill matches first.
       const evolutionResult = await this.skillEvo.evolveSkill(message);
       if (evolutionResult) {
          log(`[Agent] Evolved new skill: ${evolutionResult.skillId}`);
          return `I've just learned a new skill (${evolutionResult.skillId}) to help with that! Please ask me again to use it.`;
       }
    }

    // 1. Retrieve Context
    log(`[Agent] Retrieving context for user ${userId}...`);
    const context = await this.memoryManager.getFormattedMemories(userId, message);
    
    // 2. Build Prompt
    const systemPrompt = `
You are Redigg, an autonomous research agent.
Your goal is to assist researchers by providing accurate, insightful, and personalized responses.

User Context & Preferences:
${context || 'No prior context available.'}

Instructions:
- Use the provided context to tailor your response.
- Be concise and scientific.
- If you don't know something, admit it.
    `.trim();

    // 3. Generate Response
    log(`[Agent] Generating response...`);
    
    let reply = '';

    if (this.llm.chatStream && onProgress) {
        await this.llm.chatStream([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
        ], {
            onToken: (token) => {
                reply += token;
                onProgress('token', token);
            },
            onError: (err) => console.error(err)
        });
    } else {
        const response = await this.llm.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
        ]);
        reply = response.content;
    }

    // 4. Evolve Memory (Async)
    // We don't await this to keep response latency low
    this.memoryEvo.evolve(userId, message, reply).catch(err => {
      console.error('[Agent] Memory evolution failed:', err);
    });

    return reply;
  }
}
