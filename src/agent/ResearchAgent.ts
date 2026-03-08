import { MemoryManager } from '../memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../memory/evolution/MemoryEvolutionSystem.js';
import { SkillEvolutionSystem } from '../skills/evolution/SkillEvolutionSystem.js';
import { LLMClient } from '../llm/LLMClient.js';
import { SkillManager } from '../skills/SkillManager.js';
import { SessionManager, Session } from '../session/SessionManager.js';
import { CronManager } from '../scheduling/CronManager.js';
import { EventManager } from '../events/EventManager.js';
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

      // Hook Memory Evolution to chat events or explicit triggers?
      // Currently Memory Evolution is called explicitly in `chat()`.
      // We can decouple it by emitting an event 'agent:chat_complete' and having a listener.
      // But `chat` is async and returns a response, so we might want to keep evolution inside for now,
      // or make it purely background via event.
      // Let's keep it explicit for now but emit events *from* it.
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
      // logger.debug(content); // Too verbose for main log
      // Encode stats into the log string if provided, using a special delimiter
      const payload = stats ? `${content}__STATS__${JSON.stringify(stats)}` : content;
      onProgress?.('log', payload);
    };

    const sendPlan = (plan: any) => {
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

    // Intent Detection & Planning
    const plan = await this.createPlan(message);
    
    let reply = '';

    if (plan.intent === 'multi_step' || (plan.intent === 'single' && plan.steps.length > 0)) {
        // Send initial plan to UI
        sendPlan({ steps: plan.steps });
        
        for (let i = 0; i < plan.steps.length; i++) {
            const step = plan.steps[i];
            
            // Update UI: Step in progress
            step.status = 'in_progress';
            sendPlan({ steps: plan.steps });
            
            log(`[Planner] Executing step ${i + 1}: ${step.description}`);
            
            try {
                // Execute Step
                const result = await this.executeStep(session, userId, step, log);
                
                // Update UI: Step completed
                step.status = 'completed';
                step.result = result;
                sendPlan({ steps: plan.steps });
                
                if (result) {
                    if (plan.steps.length === 1 && plan.intent === 'single') {
                        reply = result;
                    } else {
                        reply += `\n\n**Step ${i + 1} Result:**\n${result}`;
                    }
                }
            } catch (e) {
                // Update UI: Step failed
                step.status = 'failed';
                step.error = String(e);
                sendPlan({ steps: plan.steps });
                log(`[Planner] Step ${i + 1} failed: ${e}`);
                reply += `\n\n**Step ${i + 1} Failed:** ${e}`;
            }
        }
        
        // Final consolidation
        this.sessionManager.addMessage(session.id, 'assistant', reply);
    } else {
        // Legacy logic fallback
        reply = await this.executeLegacyLogic(session, userId, message, log);
    }

    // Evolve Memory (Async)
    this.memoryEvo.evolve(userId, message, reply).then(result => {
        if (result && result.added && result.added.length > 0) {
            log(`[Evolution] Extracted ${result.added.length} new memories.`);
            result.added.forEach((m: any) => {
                log(`[Evolution] New Memory: "${m.content}" (${m.type}/${m.tier})`);
            });

            // If a new memory is created, we can append a small note to the chat history or just rely on the logs.
            // The user requested: "create a chat, tell user we have new memory"
            // So we will add a system/agent message.
            
            if (result.added.length > 0) {
                 const memoryContent = result.added[0].content;
                 const note = `(I've noted: "${memoryContent}")`;
                 // We don't want to create a whole new bubble if possible, or maybe we do.
                 // Let's add a separate message for now.
                 this.sessionManager.addMessage(session.id, 'assistant', note);
                 // We also need to send this to the client if it's connected via stream, but `chat` method returns the *first* reply.
                 // The client polls or listens to events. The `addMessage` saves it to DB.
                 // If using SSE, we should push this event.
                 // But `chat` function finishes and returns `reply`.
                 
                 // If we want to push this to the UI *after* the main reply, we need the SSE handler passed in `onProgress` to handle a "message" event?
                 // Currently `onProgress` handles tokens and logs.
                 
                 // Let's just log it for now as requested by the specific instruction "log it out".
                 // Wait, instruction says "create a chat, tell user".
                 // Since `chat` returns a string, we can't easily append another message to the return value without confusing the caller.
                 // But we can save it to history. The UI might pick it up on refresh or if it listens to "new message".
            }
        }
        if (result && result.updated && result.updated.length > 0) {
             log(`[Evolution] Updated ${result.updated.length} memories.`);
             result.updated.forEach((m: any) => {
                log(`[Evolution] Updated Memory: "${m.content}" (${m.type}/${m.tier})`);
             });
        }

        // Trigger memory consolidation immediately after new interaction
        this.memoryManager.consolidateMemories(userId).then(() => {
             // logger.debug('Post-chat consolidation complete');
        }).catch(e => {
             logger.error('Post-chat consolidation failed', e);
        });

        // After response and memory evolution, generate a title for the session if it's still generic
        if (session.messages.length <= 4 && (session.title || '').length > 20) { // Early in convo or long default title
            this.generateSessionTitle(session, message, reply).then(title => {
                if (title) {
                    session.title = title;
                    onProgress?.('token', `[TITLE_GENERATED]${title}`);
                }
            });
        }
    }).catch(err => {
      logger.error('Memory evolution failed:', err);
    });

    return reply;
  }

  private async createPlan(message: string): Promise<{ intent: string, steps: any[] }> {
      const prompt = `
You are a planner for a research agent.
User Request: "${message}"

Available Tools:
- LiteratureReview: Search for academic papers. Params: { topic: string }
- CodeAnalysis: Analyze project structure/files. Params: { path: string, operation: "structure" }
- MemorySearch: Recall past conversations/facts. Params: { query: string }
- FileOps: Organize files. Params: { operation: "organize" }
- AgentOrchestration: Manage sub-agents. Params: { operation: "create_agent" | "list_agents", name?: string, role?: string }
- Evolution: Create new skills. Params: { intent: string }
- Chat: General conversation, greetings, or questions not covered by tools. Params: { message: string }

Analyze the request. Break it down into logical steps if needed.
If the request implies a complex workflow (e.g. "Search papers and then summarize"), create multiple steps.
If it's a simple request, create one step.

Return ONLY JSON in this format:
{
  "intent": "single" | "multi_step",
  "steps": [
    { 
      "id": "1", 
      "description": "Short description of step", 
      "tool": "ToolName", 
      "params": { ... } 
    }
  ]
}
`;
      try {
          const response = await this.llm.chat([{ role: 'user', content: prompt }]);
          let text = response.content.trim();
          // Clean up markdown blocks
          if (text.startsWith('```')) {
              text = text.replace(/^```(json)?/, '').replace(/```$/, '');
          }
          const plan = JSON.parse(text);
          return plan;
      } catch (e) {
          logger.error('Planning failed:', e);
          // Fallback to empty plan (will trigger legacy logic)
          return { intent: 'single', steps: [] }; 
      }
  }

  private async executeStep(session: Session, userId: string, step: any, log: (content: string, stats?: any) => void): Promise<string> {
      switch (step.tool) {
          case 'LiteratureReview':
              return this.executeLiteratureReview(session, userId, step.params.topic, log);
          
          case 'CodeAnalysis':
              const caResult = await this.skillManager.executeSkill('code_analysis', userId, step.params);
              return `Code Structure:\n${caResult.structure}`;

          case 'MemorySearch':
              const memResult = await this.skillManager.executeSkill('memory_management', userId, { 
                  operation: 'search', 
                  query: step.params.query 
              });
              const memories = memResult.results as any[];
              if (memories.length === 0) return `No memories found for "${step.params.query}".`;
              return memories.map(m => `- ${m.content}`).join('\n');

          case 'FileOps':
              const fileResult = await this.skillManager.executeSkill('local_file_ops', userId, step.params);
              return `Organized ${fileResult.moved} files.`;

          case 'AgentOrchestration':
              const agentResult = await this.skillManager.executeSkill('agent_orchestration', userId, step.params);
              if (step.params.operation === 'list_agents') {
                  const agents = agentResult.agents as any[];
                  return `Active Agents:\n${agents.map(a => `- ${a.name}`).join('\n')}`;
              }
              return `Agent Operation Result: ${JSON.stringify(agentResult)}`;

          case 'Evolution':
              const evoResult = await this.skillManager.executeSkill('evolution', userId, {
                   operation: 'create_skill',
                   intent: step.params.intent
              });
              return evoResult.success ? `Evolved new skill: ${evoResult.skillId}` : `Evolution failed: ${evoResult.message}`;

          case 'Chat':
              // Use direct LLM call to avoid recursion loop
              const context = await this.memoryManager.getFormattedMemories(userId, step.params.message);
              const history = this.sessionManager.getHistory(session.id, 5);
              const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
              
              const systemPrompt = `You are Redigg. Context:\n${context}\nHistory:\n${historyText}`;
              const response = await this.llm.chat([
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: step.params.message }
              ]);
              return response.content;

          default:
              return `Unknown tool: ${step.tool}`;
      }
  }

  private async executeLegacyLogic(session: Session, userId: string, message: string, log: (content: string, stats?: any) => void): Promise<string> {
    const lowerMsg = message.toLowerCase();

    // 1. Research Skills / Web Search
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
    
    // Since we are in legacy logic, we don't have access to onProgress directly if we want to stream inside here,
    // but we can assume executeLegacyLogic is awaited.
    // However, if we want to stream, we need to pass the streaming callback.
    // I simplified executeLegacyLogic to just return string for now, skipping streaming in fallback to keep it simple.
    // Or I can copy the streaming logic.
    // Given the complexity, I'll just use non-streaming for legacy fallback inside this refactor.

    const response = await this.llm.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
    ]);
    reply = response.content;

    // Save response to session
    this.sessionManager.addMessage(session.id, 'assistant', reply);
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
        'literature_review', 
        userId, 
        { topic },
        (type, content) => log(`[Skill] ${content}`)
      );
      const duration = Date.now() - startTime;
      const tokens = Math.ceil(result.summary.length / 4); // Estimate
      
      log(`[Agent] Completed Literature Review`, { duration, tokens, operation: 'literature_review' });
      
      const response = `Here is a literature review on "${topic}":\n\n${result.summary}\n\n**Sources:**\n${result.papers.map((p: any) => `- ${p.title} (${p.year})`).join('\n')}`;
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
