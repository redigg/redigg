import { MemoryManager } from '../memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../memory/evolution/MemoryEvolutionSystem.js';
import { SkillEvolutionSystem } from '../skills/evolution/SkillEvolutionSystem.js';
import { LLMClient } from '../llm/LLMClient.js';
import { SkillManager } from '../skills/SkillManager.js';
import { SessionManager, Session } from '../session/SessionManager.js';
import { CronManager } from '../scheduling/CronManager.js';
import { EventManager } from '../events/EventManager.js';
import { QualityManager } from '../quality/QualityManager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Agent');

export class ResearchAgent {
  public memoryManager: MemoryManager;
  private memoryEvo: MemoryEvolutionSystem;
  private skillEvo: SkillEvolutionSystem;
  private llm: LLMClient;
  public skillManager: SkillManager;
  public sessionManager: SessionManager;
  public cronManager: CronManager;
  public eventManager: EventManager;
  public qualityManager: QualityManager;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    memoryManager: MemoryManager,
    memoryEvo: MemoryEvolutionSystem,
    llm: LLMClient,
    skillManager?: SkillManager
  ) {
    this.memoryManager = memoryManager;
    this.memoryEvo = memoryEvo;
    this.llm = llm;
    this.sessionManager = new SessionManager(memoryManager.storage); // Reuse storage
    this.cronManager = new CronManager();
    this.eventManager = new EventManager();
    this.qualityManager = new QualityManager(llm);
    
    // Pass managers to SkillManager for injection into SkillContext
    this.skillManager = skillManager || new SkillManager(llm, memoryManager, process.cwd());
    
    // Inject managers now that they are created
    this.skillManager.setManagers({
        cron: this.cronManager,
        session: this.sessionManager,
        skill: this.skillManager, // Self-reference for skills that need to execute other skills
        event: this.eventManager,
    });
    
    this.skillEvo = new SkillEvolutionSystem(this.skillManager, llm);
    
    // Trigger loading from disk (async)
    this.skillManager.loadSkillsFromDisk().catch(err => {
        logger.error('Failed to load skills from disk:', err);
    });

    // Wire up events
    this.setupEventListeners();
  }

  private setupEventListeners() {
      // Example: Log all commands
      this.eventManager.on('command:executed', (payload) => {
          logger.info(`[Event] Command Executed: ${payload.command}`);
      });

      // Example: Log memory additions
      this.eventManager.on('memory:added', (payload) => {
          logger.info(`[Event] Memory Added: ${payload.id} (${payload.type})`);
      });
  }

  public async start() {
    logger.info('Starting heartbeat...');
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 60000); // Every minute
    
    // Initial check on start
    this.heartbeat().catch(e => logger.error('Initial heartbeat failed:', e));
  }

  public stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Stopped heartbeat.');
    }
  }

  private async heartbeat() {
    logger.debug('[Agent] Heartbeat...');
    
    // Execute Heartbeat Skill
    try {
        // SkillManager loads skills asynchronously, so "heartbeat" might not be ready on first call
        // We should check if it's available or wait/retry, but for now we just catch error
        if (this.skillManager.getSkill('heartbeat')) {
            const result = await this.skillManager.executeSkill('heartbeat', 'system', {});
            
            // Check for significant updates and notify active session if possible
            const memoryStats = result.memory;
            if (memoryStats && (memoryStats.moved > 0 || memoryStats.promoted > 0 || memoryStats.pruned > 0)) {
                const msg = `[System Heartbeat] Memory Optimization: Moved ${memoryStats.moved} to short-term, Promoted ${memoryStats.promoted} to long-term.`;
                
                const session = this.sessionManager.getOrCreateActiveSession('web-user');
                if (session) {
                    this.sessionManager.addMessage(session.id, 'assistant', msg);
                }
            }

            const skillStats = result.skills;
            if (skillStats) {
                // Log stats
            }
        } else {
             logger.warn('Heartbeat skill not found (yet). Skipping this beat.');
        }
    } catch (e) {
        logger.error('Heartbeat skill failed:', e);
    }

    // 3. Cron jobs are handled by CronManager independently
  }

  public async chat(
    userId: string, 
    message: string, 
    onProgress?: (type: 'token' | 'log' | 'plan', content: any) => void,
    sessionId?: string
  ): Promise<string> {
    // Helper to log and emit progress
    const log = (content: string, stats?: any) => {
      const payload = stats ? `${content}__STATS__${JSON.stringify(stats)}` : content;
      onProgress?.('log', payload);
      // Persist log to session history
      this.sessionManager.addMessage(session.id, 'log', payload);
    };

    // Send plan update
    const sendPlan = (plan: { steps: any[] }) => {
        onProgress?.('plan', plan);
    };

    // Get or create session
    let session: Session;
    if (sessionId) {
      const existing = this.sessionManager.getSession(sessionId);
      if (existing && existing.userId === userId) {
        session = existing;
      } else {
        session = this.sessionManager.createSession(userId);
      }
    } else {
      session = this.sessionManager.getOrCreateActiveSession(userId);
    }
    
    // Update session title if it's the first user message
    if (session.messages.length === 0) {
        session.title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
    }

    this.sessionManager.addMessage(session.id, 'user', message);

    // 1. Plan
    logger.info(`Creating plan for user ${userId}...`);
    log(`[Agent] Planning response...`);
    
    // Check if message is simple conversational
    const isConversational = /^(hello|hi|hey|thanks|thank you|bye|goodbye|ok|okay|yes|no|cool|great|wow|who are you|what are you)\b/i.test(message.trim().replace(/[!.?]+$/, ''));
    
    let plan = { intent: 'single', steps: [] as any[] };
    
    if (!isConversational) {
        try {
            plan = await this.createPlan(message);
            if (plan.steps.length > 0) {
                log(`[Agent] Created plan with ${plan.steps.length} steps.`);
                sendPlan({ steps: plan.steps });
            }
        } catch (e) {
            logger.error('Planning failed, falling back to legacy logic', e);
        }
    }

    let reply = '';

    // 2. Execute Plan or Fallback
    if (plan.intent === 'multi_step' || (plan.intent === 'single' && plan.steps.length > 0)) {
        for (const step of plan.steps) {
            step.status = 'in_progress';
            sendPlan({ steps: plan.steps });
            
            let retryCount = 0;
            const maxRetries = 2;
            let success = false;
            const stepStartTime = Date.now();

            while (retryCount <= maxRetries && !success) {
                try {
                    if (retryCount > 0) {
                        log(`[Agent] Retry ${retryCount}/${maxRetries} for step: ${step.description}`);
                    } else {
                        log(`[${step.tool}] ${step.description}`);
                    }
                    
                    const result = await this.executeStep(step, userId, session, log);
                    
                    const duration = Date.now() - stepStartTime;
                    // Estimate tokens based on result length if string
                    const tokens = typeof result === 'string' ? Math.ceil(result.length / 4) : 0;
                    log(`[${step.tool}] Step completed`, { duration, tokens });

                    step.status = 'completed';
                    step.result = result;
                    success = true;
                    
                    if (step.tool === 'Chat') {
                        reply = result;
                    }
                } catch (e) {
                    retryCount++;
                    const errorMsg = String(e);
                    const duration = Date.now() - stepStartTime;
                    logger.error(`Step failed (Attempt ${retryCount}): ${step.description}`, e);
                    
                    if (retryCount > maxRetries) {
                        step.status = 'failed';
                        step.error = errorMsg;
                        log(`[Error] Step failed permanently: ${step.description}`, { duration });
                    } else {
                        log(`[Warning] Step failed, retrying... (${errorMsg})`, { duration });
                        // Wait a bit before retry
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            sendPlan({ steps: plan.steps });
        }
        
        if (!reply) {
            // If no chat step, summarize results
            const completedSteps = plan.steps.filter(s => s.status === 'completed');
            const failedSteps = plan.steps.filter(s => s.status === 'failed');
            
            let summary = "I have completed the requested tasks.\n\n";
            if (completedSteps.length > 0) {
                summary += "**Completed:**\n" + completedSteps.map(s => `- ${s.description}`).join('\n') + "\n";
            }
            if (failedSteps.length > 0) {
                summary += "\n**Failed:**\n" + failedSteps.map(s => `- ${s.description}: ${s.error}`).join('\n');
            }
            
            reply = summary;
            this.sessionManager.addMessage(session.id, 'assistant', reply);
        }
        
    } else {
        // Legacy logic fallback
        reply = await this.executeLegacyLogic(session, userId, message, log, onProgress);
    }

    // 3. Post-processing (Memory Evolution, Title Generation) - same as legacy
    // Note: executeLegacyLogic already does this if called.
    // If we executed a plan, we should also trigger evolution/title gen?
    // For now, let's rely on executeLegacyLogic to handle it, or duplicate it here.
    // Ideally refactor into `postProcess(session, message, reply)`.
    
    // Since legacy logic does it internally, we skip if legacy was used.
    if (plan.steps.length > 0) {
         // Trigger evolution for planned execution results too?
         // Maybe just for the final reply if it exists.
         if (reply) {
             await this.handlePostProcessing(session, userId, message, reply, log, onProgress);
         }
    }

    return reply;
  }

  private async createPlan(message: string): Promise<{ intent: string, steps: any[] }> {
      const prompt = `
You are a planning engine for a research agent.
User Request: "${message}"

Available Tools:
- LiteratureReview(topic): Search for papers/web.
- PaperAnalysis(title): Analyze a specific paper in depth.
- ConceptExplainer(concept): Explain a scientific concept.
- PdfGenerator(title, content): Generate a PDF report.
- CodeAnalysis(path): Analyze project structure/code.
- MemorySearch(query): Search past memories.
- FileOps(operation): Organize files.
- AgentOrchestration(operation): Create/manage sub-agents.
- Evolution(intent): Create new skills.
- Chat(message): Reply to user (final step).

Return a JSON plan:
{
  "intent": "single" | "multi_step",
  "steps": [
    { 
      "id": "1", 
      "description": "Concise action description (e.g., 'Searching arXiv for AI Agents')", 
      "tool": "ToolName", 
      "params": { ... } 
    }
  ]
}
`;
      try {
          const response = await this.llm.chat([{ role: 'user', content: prompt }]);
          let text = response.content.trim();
          if (text.startsWith('```')) {
              text = text.replace(/^```(json)?/, '').replace(/```$/, '');
          }
          const plan = JSON.parse(text);
          return plan;
      } catch (e) {
          logger.error('Planning failed:', e);
          return { intent: 'single', steps: [] };
      }
  }

  private async executeStep(step: any, userId: string, session: Session, log: (c: string) => void): Promise<string> {
      switch (step.tool) {
          case 'LiteratureReview':
              return this.executeLiteratureReview(session, userId, step.params.topic, log);
          case 'ConceptExplainer':
              const ceResult = await this.skillManager.executeSkill('concept_explainer', userId, { concept: step.params.concept });
              return ceResult.formatted_output;
          case 'PdfGenerator':
              const pdfResult = await this.skillManager.executeSkill('pdf_generator', userId, { title: step.params.title, content: step.params.content });
              return pdfResult.formatted_output;
          case 'CodeAnalysis':
               const caResult = await this.skillManager.executeSkill('code_analysis', userId, { path: step.params.path || '.', operation: 'structure' });
               return `Project Structure:\n${caResult.structure}`;
          case 'MemorySearch':
               const msResult = await this.skillManager.executeSkill('memory_management', userId, { operation: 'search', query: step.params.query });
               return JSON.stringify(msResult.results);
          case 'FileOps':
               const foResult = await this.skillManager.executeSkill('local_file_ops', userId, { operation: step.params.operation });
               return `Moved ${foResult.moved} files.`;
          case 'AgentOrchestration':
               // ... simplified
               return "Agent orchestration not fully implemented in plan yet.";
          case 'Evolution':
               // ... simplified
               return "Evolution not fully implemented in plan yet.";
          case 'Chat':
              // Use direct LLM call to avoid recursion loop
              // But we need context.
              const context = await this.memoryManager.getFormattedMemories(userId, step.params.message);
              const response = await this.llm.chat([
                  { role: 'system', content: `You are Redigg. Context: ${context}` },
                  { role: 'user', content: step.params.message }
              ]);
              const reply = response.content;
              this.sessionManager.addMessage(session.id, 'assistant', reply);
              return reply;
          default:
              throw new Error(`Unknown tool: ${step.tool}`);
      }
  }
  
  private async handlePostProcessing(
      session: Session, 
      userId: string, 
      message: string, 
      reply: string, 
      log: (c: string) => void,
      onProgress?: any
  ) {
    // Evolve Memory (Async)
    try {
        const result = await this.memoryEvo.evolve(userId, message, reply, (msg) => log(msg));
        if (result && result.added && result.added.length > 0) {
            // log(`[Evolution] Extracted ${result.added.length} new memories.`); // Redundant as memoryEvo logs it now
        }
        await this.memoryManager.consolidateMemories(userId).catch(e => logger.error('Consolidation failed', e));
    } catch (err) {
      logger.error('Memory evolution failed:', err);
    }
  }

  public async executeLegacyLogic(
    session: Session,
    userId: string, 
    message: string, 
    log: (content: string, stats?: any) => void,
    onProgress?: (type: 'token' | 'log' | 'plan', content: any) => void
  ): Promise<string> {

    const lowerMsg = message.toLowerCase();

    // 1. Research Skills / Web Search
    if (lowerMsg.includes('analyze paper') || lowerMsg.includes('summary of paper') || lowerMsg.includes('critique paper')) {
        const title = message.replace(/\b(analyze paper|summary of paper|critique paper|about|on)\b/gi, '').trim();
        if (title.length > 3) {
            log(`[Agent] Analyzing paper: "${title}"`);
            const result = await this.skillManager.executeSkill('paper_analysis', userId, { paper_title: title });
            this.sessionManager.addMessage(session.id, 'assistant', result.formatted_output);
            return result.formatted_output;
        }
    }

    if (lowerMsg.startsWith('explain') || lowerMsg.includes('what is') || lowerMsg.includes('concept of')) {
        // Simple heuristic: if it looks like a concept question
        // But "what is your name" is conversational.
        if (!lowerMsg.includes('your name') && !lowerMsg.includes('the time')) {
             const concept = message.replace(/\b(explain|what is|concept of|tell me about)\b/gi, '').trim();
             // Let's rely on LLM decision engine usually, but here we can force it if explicitly asked "explain X"
             if (lowerMsg.startsWith('explain')) {
                 log(`[Agent] Explaining concept: "${concept}"`);
                 const result = await this.skillManager.executeSkill('concept_explainer', userId, { concept });
                 this.sessionManager.addMessage(session.id, 'assistant', result.formatted_output);
                 return result.formatted_output;
             }
        }
    }

    if (lowerMsg.includes('literature review') || lowerMsg.includes('search papers') || message.includes('[WEB SEARCH REQUEST]')) {
      let topic = message.replace(/\b(do a|perform a|literature review|search papers|about|on)\b/gi, '').trim().replace(/\s+/g, ' ');
      
      if (message.includes('[WEB SEARCH REQUEST]')) {
          topic = message.replace('[WEB SEARCH REQUEST]', '').split('\n')[0].trim(); // Extract first line as topic usually
          // Clean up the prompt suffix if present
          topic = topic.replace('Please perform a literature review or web search to answer this question.', '').trim();
      }

      if (topic.length > 3) {
        return this.executeLiteratureReview(session, userId, topic, log);
      }
    }

    // 2. Infra Skills
    if (lowerMsg.includes('analyze code') || lowerMsg.includes('project structure')) {
      try {
        const targetPath = '.'; 
        logger.info(`Analyzing code in ${targetPath}...`);
        const startTime = Date.now();
        log(`[Agent] Analyzing code in ${targetPath}...`);
        
        const result = await this.skillManager.executeSkill('code_analysis', userId, { path: targetPath, operation: 'structure' });
        
        const duration = Date.now() - startTime;
        const tokens = Math.ceil(result.structure.length / 4);
        log(`[Agent] Completed Code Analysis`, { duration, tokens, operation: 'code_analysis' });

        const response = `Here is the project structure:\n\`\`\`\n${result.structure}\n\`\`\``;
        this.sessionManager.addMessage(session.id, 'assistant', response);
        return response;
      } catch (e) {
        logger.error('Skill execution failed:', e);
      }
    }

    if (lowerMsg.includes('organize files') || lowerMsg.includes('move pdfs')) {
      try {
        logger.info('Organizing files...');
        const startTime = Date.now();
        log('[Agent] Organizing files...');
        
        const result = await this.skillManager.executeSkill('local_file_ops', userId, { operation: 'organize' });
        
        const duration = Date.now() - startTime;
        log(`[Agent] Completed File Organization`, { duration, tokens: 0, operation: 'file_ops' });

        const response = `I have organized your PDF files into a 'papers' folder. Moved ${result.moved} files.`;
        this.sessionManager.addMessage(session.id, 'assistant', response);
        return response;
      } catch (e) {
        logger.error('Skill execution failed:', e);
      }
    }

    // 3. Core Skills (Memory, Agents, Evolution)
    if (lowerMsg.includes('search memories') || lowerMsg.includes('recall')) {
      try {
        const query = message.replace(/\b(search memories|recall|find memory about)\b/gi, '').trim();
        logger.info(`Searching memories for "${query}"...`);
        const startTime = Date.now();
        log(`[Agent] Searching memories for "${query}"...`);
        
        const result = await this.skillManager.executeSkill('memory_management', userId, { 
            operation: 'search', 
            query 
        });
        
        const duration = Date.now() - startTime;
        const memories = result.results as any[];
        const tokens = Math.ceil(JSON.stringify(memories).length / 4);
        log(`[Agent] Completed Memory Search`, { duration, tokens, operation: 'memory_search' });
        
        let response = '';
        if (memories.length === 0) {
            response = `I couldn't find any memories matching "${query}".`;
        } else {
            response = `Here are the memories I found:\n\n${memories.map(m => `- [${m.tier}] ${m.content} (${new Date(m.created_at).toLocaleDateString()})`).join('\n')}`;
        }
        this.sessionManager.addMessage(session.id, 'assistant', response);
        return response;
      } catch (e) {
        logger.error('Memory search failed:', e);
      }
    }

    if (lowerMsg.includes('create agent') || lowerMsg.includes('sub-agent') || lowerMsg.includes('delegate') || lowerMsg.includes('list agents')) {
        try {
            if (lowerMsg.includes('create agent')) {
                const nameMatch = message.match(/named\s+["']?(\w+)["']?/i);
                const roleMatch = message.match(/role\s+of\s+["']?([\w\s]+)["']?/i);
                const name = nameMatch ? nameMatch[1] : 'Assistant';
                const role = roleMatch ? roleMatch[1] : 'Generalist';
                
                const result = await this.skillManager.executeSkill('agent_orchestration', userId, {
                    operation: 'create_agent',
                    name,
                    role
                });
                
                const response = `Created sub-agent ${result.name} (ID: ${result.agentId})`;
                this.sessionManager.addMessage(session.id, 'assistant', response);
                return response;
            } else if (lowerMsg.includes('list agents')) {
                const result = await this.skillManager.executeSkill('agent_orchestration', userId, {
                    operation: 'list_agents'
                });
                const agents = result.agents as any[];
                const response = `Active Agents:\n${agents.map(a => `- ${a.name} (${a.role})`).join('\n')}`;
                this.sessionManager.addMessage(session.id, 'assistant', response);
                return response;
            }
        } catch (e) {
            logger.error('Orchestration failed:', e);
        }
    }

    if (lowerMsg.includes('can you') || lowerMsg.includes('how do i') || lowerMsg.includes('evolve')) {
       logger.info('Checking if I need to learn a new skill or evolve...');
       log('[Agent] Checking if I need to learn a new skill or evolve...');
       try {
           const intent = message.replace(/\b(can you|how do i|evolve|create a skill to)\b/gi, '').trim();
           if (intent.length > 5) {
               const result = await this.skillManager.executeSkill('evolution', userId, {
                   operation: 'create_skill',
                   intent
               });
               
               if (result.success) {
                   const response = `I've evolved! ${result.message} (Skill ID: ${result.skillId})`;
                   this.sessionManager.addMessage(session.id, 'assistant', response);
                   return response;
               }
           }
       } catch (e) {
           // Fallback
       }
    }

    // 4. Intelligent Default: Web Search for Unknown Topics
    // Check if we have relevant memories. Strict search (no fallback to recent).
    // This implements the "Default to Search" behavior for new topics.
    const strictMemories = await this.memoryManager.searchMemories(userId, message, { limit: 1 });
    const hasContext = strictMemories.length > 0;
    const isConversational = /^(hello|hi|hey|thanks|thank you|bye|goodbye|ok|okay|yes|no|cool|great|wow|who are you|what are you)\b/i.test(message.trim().replace(/[!.?]+$/, ''));

    if (!hasContext && !isConversational) {
        log('[Agent] No local knowledge found. Checking if web search is needed...');
        const decision = await this.shouldSearch(message, log);
        
        if (decision.shouldSearch) {
             logger.info(`Implicit intent: Web Search on "${decision.topic}"`);
             log(`[Agent] Decided to search web for: "${decision.topic}"`);
             
             return this.executeLiteratureReview(session, userId, decision.topic, log);
        } else {
             log('[Agent] Decided not to search web. Generating response...');
        }
    }

    // 5. Fallback: LLM Chat
    logger.info(`Retrieving context for user ${userId}...`);
    log(`[Agent] Retrieving context for user ${userId}...`);
    const context = await this.memoryManager.getFormattedMemories(userId, message);
    
    // Retrieve Session History
    const history = this.sessionManager.getHistory(session.id, 5); // Last 5 messages
    const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    // Build Prompt
    const systemPrompt = `
You are Redigg, an autonomous research agent.
Your goal is to assist researchers by providing accurate, insightful, and personalized responses.

User Context & Preferences:
${context || 'No prior context available.'}

Session History:
${historyText}

Instructions:
- Use the provided context to tailor your response.
- Be concise and scientific.
- If you don't know something, admit it.
    `.trim();

    // Generate Response
    logger.info(`Generating response...`);
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
            onError: (err) => logger.error(String(err))
        });
    } else {
        const response = await this.llm.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
        ]);
        reply = response.content;
    }

    // Save response to session
    this.sessionManager.addMessage(session.id, 'assistant', reply);

    // Evolve Memory (Async - now awaited to ensure logs are streamed)
    try {
        const result = await this.memoryEvo.evolve(userId, message, reply, (msg) => log(msg));
        
        if (result && result.added && result.added.length > 0) {
            log(`[Evolution] Extracted ${result.added.length} new memories.`);
            result.added.forEach((m: any) => {
                log(`[Evolution] New Memory: "${m.content}" (${m.type}/${m.tier})`);
            });
            // Silent execution: no chat message for memory updates
        }
        if (result && result.updated && result.updated.length > 0) {
             log(`[Evolution] Updated ${result.updated.length} memories.`);
             result.updated.forEach((m: any) => {
                log(`[Evolution] Updated Memory: "${m.content}" (${m.type}/${m.tier})`);
             });
        }

        // Trigger memory consolidation immediately after new interaction
        await this.memoryManager.consolidateMemories(userId).then(() => {
             // logger.debug('Post-chat consolidation complete');
        }).catch(e => {
             logger.error('Post-chat consolidation failed', e);
        });

        // After response and memory evolution, generate a title for the session if it's still generic
        if (session.messages.length <= 4 && (session.title || '').length > 20) { // Early in convo or long default title
            const title = await this.generateSessionTitle(session, message, reply);
            if (title) {
                session.title = title;
                onProgress?.('token', `[TITLE_GENERATED]${title}`);
            }
        }
    } catch (err) {
      logger.error('Memory evolution failed:', err);
    }

    return reply;
  }

  private async generateSessionTitle(session: Session, userMsg: string, agentMsg: string): Promise<string | null> {
      try {
          const prompt = `Summarize the following conversation into a short, 3-5 word title. Do not use quotes.
User: ${userMsg}
Agent: ${agentMsg}
Title:`;
          const response = await this.llm.chat([{ role: 'user', content: prompt }]);
          return response.content.trim();
      } catch (e) {
          return null;
      }
  }

  private async executeLiteratureReview(session: Session, userId: string, topic: string, log: (content: string, stats?: any) => void): Promise<string> {
    logger.info(`Detected intent: Literature Review on "${topic}"`);
    const startTime = Date.now();
    log(`[Agent] Detected intent: Literature Review (Web Search) on "${topic}"`);
    
    try {
      const result = await this.skillManager.executeSkill(
        'academic_survey_self_improve', 
        userId, 
        { topic },
        (type, content) => log(`[Skill] ${content}`)
      );
      const duration = Date.now() - startTime;
      const tokens = Math.ceil(result.summary.length / 4); // Estimate
      
      log(`[Agent] Completed Literature Review`, { duration, tokens, operation: 'literature_review' });
      
      const response = `Here is a literature review on "${topic}":\n\n${result.summary}\n\n**Sources:**\n${result.papers.map((p: any) => `- [${p.title}](${p.url || '#'}) (${p.year})`).join('\n')}`;
      
      // Perform Quality Check
      const quality = await this.qualityManager.evaluateTask(
          `Literature Review on "${topic}"`,
          result.summary,
          { papersCount: result.papers.length }
      );
      
      if (!quality.passed) {
          log(`[Quality] Warning: Score ${quality.score}/100. ${quality.reasoning}`);
          const warning = `\n\n> ⚠️ **Quality Check**: This review scored ${quality.score}/100. ${quality.suggestions[0] || ''}`;
          this.sessionManager.addMessage(session.id, 'assistant', response + warning);
          return response + warning;
      }

      this.sessionManager.addMessage(session.id, 'assistant', response);
      return response;
    } catch (e) {
      logger.error('Skill execution failed:', e);
      const errorMsg = "I encountered an error while searching for papers.";
      this.sessionManager.addMessage(session.id, 'assistant', errorMsg);
      return errorMsg;
    }
  }

  private async shouldSearch(message: string, log?: (content: string, stats?: any) => void): Promise<{ shouldSearch: boolean; topic: string }> {
      const prompt = `
You are a decision engine for a research agent.
The user sent: "${message}"
We have NO local memory/context about this topic.

Should we perform a web search to answer this?
- YES if it asks for facts, news, definitions, explanations of concepts, or research.
- NO if it is conversational (greeting, thanks), personal ("who are you"), or asks about "this project" or "code" (which should have been caught by other skills).

Reply strictly in this format:
SEARCH: <topic>
or
NO_SEARCH
`;
      try {
          if (log) log('[Agent] Thinking about whether to search the web...');
          const res = await this.llm.chat([{ role: 'user', content: prompt }]);
          console.log('[DEBUG] shouldSearch response:', res);
          const text = res.content.trim();
          if (text.startsWith('SEARCH:')) {
              return { shouldSearch: true, topic: text.replace('SEARCH:', '').trim() };
          }
      } catch (e) {
          logger.error('Decision engine failed:', e);
      }
      return { shouldSearch: false, topic: '' };
  }
}
