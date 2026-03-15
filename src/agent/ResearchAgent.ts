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
import { buildChatGraph } from './graph/chatGraph.js';
import { runPlan } from './execution/planRunner.js';
import type { AgentProgressHandler } from '../protocol/progress.js';
import { ensureSessionWorkspace } from '../workspace/sessionWorkspace.js';
import AcademicSurveySelfImproveSkill from '../../skills/research/academic-survey-self-improve/index.js';

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
  private chatGraph: any;

  private getGatewayBaseUrl(): string {
    return process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || '4000'}`;
  }

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

    // Keep the current survey mainline available even when disk dynamic-loading is unstable.
    if (!this.skillManager.getSkill('academic_survey_self_improve')) {
      this.skillManager.registerSkill(new AcademicSurveySelfImproveSkill());
    }
    
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

    this.chatGraph = buildChatGraph({
      createPlan: async ({ message, log, forceAuto, onProgress }) => {
        return this.createPlan(message, log, forceAuto, onProgress);
      },
      executePlan: async ({ userId, session, message, plan, log, onProgress, sendPlan, sendStepThinking, accumulatedArtifacts }) => {
        return this.executePlanFromGraph({
          userId,
          session,
          message,
          plan,
          log,
          onProgress,
          sendPlan,
          sendStepThinking,
          accumulatedArtifacts,
        });
      },
      executeLegacy: async ({ userId, session, message, log, onProgress }) => {
        return this.executeLegacyLogic(session, userId, message, log, onProgress);
      },
      postProcess: async ({ userId, session, message, reply, log, onProgress }) => {
        return this.handlePostProcessing(session, userId, message, reply, log, onProgress);
      },
    });
  }

  private async executePlanFromGraph(args: {
    userId: string;
    session: Session;
    message: string;
    plan: { intent: string; steps: any[] };
    log: (content: string, stats?: any) => void;
    onProgress?: AgentProgressHandler;
    sendPlan: (plan: { steps: any[] }) => void;
    sendStepThinking: (stepId: string, token: string) => void;
    accumulatedArtifacts: any[];
  }): Promise<{ reply: string; accumulatedArtifacts: any[] }> {
    const { userId, session, plan, log, onProgress, sendPlan, sendStepThinking, accumulatedArtifacts } = args;

    return runPlan({
      userId,
      session,
      plan,
      log,
      onProgress,
      sendPlan,
      sendStepThinking,
      accumulatedArtifacts,
      isStopped: () => this.sessionManager.isSessionStopped(session.id),
      executeStep: this.executeStep.bind(this),
      addAssistantMessage: (reply, metadata) => this.sessionManager.addMessage(session.id, 'assistant', reply, metadata),
      onStepError: (message, error) => {
        logger.error(message, error);
      },
    });
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
                logger.info(msg);
                
                // User requested not to send chat messages for background memory operations
                // const session = this.sessionManager.getOrCreateActiveSession('web-user');
                // if (session) {
                //    this.sessionManager.addMessage(session.id, 'assistant', msg);
                // }
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
    onProgress?: AgentProgressHandler,
    sessionId?: string,
    options?: { autoMode?: boolean }
  ): Promise<string> {
    // Helper to log and emit progress
    const log = (content: string, stats?: any) => {
      const payload = stats ? `${content}__STATS__${JSON.stringify(stats)}` : content;
      onProgress?.('log', payload);
      if (stats) {
        onProgress?.('stats', stats);
      }
      // Persist log to session history
      this.sessionManager.addMessage(session.id, 'log', payload);
    };

    const sendPlan = (plan: { steps: any[] }) => {
      onProgress?.('plan', plan);
      try {
        this.sessionManager.addMessage(session.id, 'plan', JSON.stringify(plan));
      } catch {}
    };

    const sendStepThinking = (stepId: string, token: string) => {
      onProgress?.('todo', { id: stepId, thinking: token });
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
    
    // Ensure session is active and running
    this.sessionManager.activateSession(session.id);
    this.sessionManager.setSessionStatus(session.id, 'running');
    
    try {
        await ensureSessionWorkspace(session.id);

        // Update session title if it's the first user message
        if (session.messages.length === 0) {
            session.title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        }

        this.sessionManager.addMessage(session.id, 'user', message);

        // 1. Plan
        logger.info(`Creating plan for user ${userId}...`);
        log(`[Agent] Planning response...`);
        
        const graphState = await this.chatGraph.invoke({
          userId,
          message,
          session,
          options,
          onProgress,
          log,
          sendPlan,
          sendStepThinking,
          accumulatedArtifacts: [],
        });

        const reply = String(graphState?.reply || '');
        return reply || 'I was unable to generate a response.';
    } finally {
        // Ensure session is back to active (not running) even if error occurred
        // BUT if it was stopped, keep it as stopped.
        if (!this.sessionManager.isSessionStopped(session.id)) {
            this.sessionManager.setSessionStatus(session.id, 'active');
        }
    }
  }

  private async createPlan(
      message: string, 
      log?: (content: string, stats?: any) => void, 
      forceAuto: boolean = false,
      onProgress?: AgentProgressHandler
  ): Promise<{ intent: string, steps: any[] }> {
      const startTime = Date.now();
      const prompt = `
You are a planning engine for a research agent.
User Request: "${message}"
Force Auto Mode: ${forceAuto}

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
- AutoResearch(topic, iterations): Continuously optimize and improve a research report in a loop.
- Chat(message): Reply to user (final step).

Return a JSON plan:
{
  "intent": "single" | "multi_step",
  "steps": [
    { 
      "id": "1", 
      "description": "Concise action description", 
      "tool": "ToolName", 
      "params": { ... } 
    }
  ]
}

Rules:
1. If 'Force Auto Mode' is true, you MUST use the 'AutoResearch' tool as the primary step.
2. If the user asks for a PDF, ALWAYS include a 'PdfGenerator' step followed by a 'Chat' step.
3. The 'Chat' step message MUST explicitly mention the generated file and include a placeholder link like '[Title](...)' to indicate where it can be downloaded.
4. If the user wants to test PDF generation directly or asks for a PDF without confirmation, just generate it.
`;
      try {
          let fullContent = '';
          if (this.llm.chatStream && onProgress) {
              await this.llm.chatStream([{ role: 'user', content: prompt }], {
                  onThinking: (token) => {
                      onProgress('thinking', token);
                  },
                  onToken: (token) => {
                      fullContent += token;
                      // We can choose to show planning process as thinking too, 
                      // or just show it as logs. For now, showing as thinking is good.
                      onProgress('thinking', token);
                  }
              });
          } else {
              const response = await this.llm.chat([{ role: 'user', content: prompt }]);
              fullContent = response.content;
              // Call onProgress even in fallback to show something
              onProgress?.('thinking', fullContent);
          }
          
          // Log stats
          const duration = Date.now() - startTime;
          const tokens = Math.ceil(fullContent.length / 4);
          if (log) {
              log(`[Agent] Created plan`, { duration, tokens, operation: 'planning' });
          }

          let text = fullContent.trim();
          if (text.startsWith('```')) {
              text = text.replace(/^```(json)?/, '').replace(/```$/, '');
          }
          const plan = JSON.parse(text);
          return forceAuto ? this.normalizeAutoResearchPlan(plan, message) : plan;
      } catch (e) {
          logger.error('Planning failed:', e);
          return { intent: 'single', steps: [] };
      }
  }

  private normalizeAutoResearchPlan(plan: any, message: string): { intent: string; steps: any[] } {
    const steps = Array.isArray(plan?.steps) ? plan.steps : [];
    const autoIndex = steps.findIndex((step: any) => step?.tool === 'AutoResearch');

    const autoStep = autoIndex >= 0
      ? steps[autoIndex]
      : {
          id: 'auto',
          description: `Conduct continuous optimization and research on the topic '${message}'`,
          tool: 'AutoResearch',
          params: { topic: message },
        };

    const topic = autoStep?.params?.topic || autoStep?.params?.query || message;
    const normalizedAutoStep = {
      ...autoStep,
      id: String(autoStep?.id || 'auto'),
      tool: 'AutoResearch',
      params: {
        ...(autoStep?.params || {}),
        topic,
      },
    };

    return {
      intent: 'single',
      steps: [normalizedAutoStep],
    };
  }

  private async executeStep(
      step: any, 
      userId: string, 
      session: Session, 
      log: (c: string, stats?: any) => void,
      onProgress?: AgentProgressHandler,
      accumulatedArtifacts: any[] = [],
      planSteps: any[] = [],
      sendStepThinking?: (stepId: string, token: string) => void
  ): Promise<{ output: string, artifacts: any[], usage?: { promptTokens: number, completionTokens: number } }> {
      let output = '';
      let artifacts: any[] = [];
      let usage: { promptTokens: number, completionTokens: number } | undefined;

      const skillHandlers = {
          onLog: (type: string, content: string) => {
              if (type === 'thinking' && sendStepThinking) {
                  sendStepThinking(step.id, content);
              } else {
                  log(`[Skill:${step.tool}] ${content}`);
              }
          },
          onProgress: async (progress: number, description: string, metadata?: any) => {
               log(`[Skill Progress] ${progress}% - ${description}`, metadata);
               // Update the step in UI
               onProgress?.('todo', { 
                   id: step.id, 
                   status: 'in_progress', 
                   content: `${step.description} (${progress}%)`,
                   metadata: metadata 
               });
          }
      };

      switch (step.tool) {
          case 'LiteratureReview':
              output = await this.executeLiteratureReview(session, userId, step.params.topic, log, onProgress, sendStepThinking ? (token) => sendStepThinking(step.id, token) : undefined);
              break;
          case 'ConceptExplainer':
              const ceResult = await this.skillManager.executeSkill('concept_explainer', userId, { concept: step.params.concept }, skillHandlers);
              output = ceResult.formatted_output;
              break;
          case 'PdfGenerator':
              const pdfContent = this.resolvePdfGeneratorContent(session, step.params.content, planSteps);
              const pdfResult = await this.skillManager.executeSkill(
                  'pdf_generator',
                  userId,
                  { title: step.params.title, content: pdfContent, sessionId: session.id },
                  skillHandlers
              );
              output = pdfResult.formatted_output;
              if (pdfResult.url && pdfResult.file_path) {
                  // Ensure URL is valid (gateway url + relative path)
                  const url = pdfResult.url.startsWith('/') ? pdfResult.url : `/${pdfResult.url}`;
                  // Use absolute URL if needed, but relative is fine for same origin
                  artifacts.push({
                      id: `file-${Date.now()}`,
                      name: `${step.params.title || 'document'}.pdf`,
                      type: 'file',
                      url: `${this.getGatewayBaseUrl()}${url}`,
                      path: pdfResult.file_path,
                      mimeType: 'application/pdf'
                  });
              }
              break;
          case 'CodeAnalysis':
               const caResult = await this.skillManager.executeSkill('code_analysis', userId, { path: step.params.path || '.', operation: 'structure' }, skillHandlers);
               output = `Project Structure:\n${caResult.structure}`;
               break;
          case 'MemorySearch':
               const msResult = await this.skillManager.executeSkill('memory_management', userId, { operation: 'search', query: step.params.query }, skillHandlers);
               output = JSON.stringify(msResult.results);
               break;
          case 'FileOps':
               const foResult = await this.skillManager.executeSkill('local_file_ops', userId, { operation: step.params.operation }, skillHandlers);
               output = `Moved ${foResult.moved} files.`;
               break;
          case 'AgentOrchestration':
               output = "Agent orchestration not fully implemented in plan yet.";
               break;
          case 'Evolution':
               output = "Evolution not fully implemented in plan yet.";
               break;
          case 'AutoResearch':
              const topic = step.params.topic || 'General Research';
              const parsedIterations = (() => {
                  const raw = step.params.iterations ?? step.params.maxIterations ?? step.params.rounds;
                  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
                  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
              })();

              const shouldDelay = !(process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');
              const maxRounds = parsedIterations;
              log(
                maxRounds
                  ? `[AutoResearch] Starting optimization loop for "${topic}". Max rounds: ${maxRounds}.`
                  : `[AutoResearch] Starting continuous optimization loop for "${topic}". Will run until stopped.`
              );
              
              let currentContent = await this.buildAutoResearchInitialDraft(session, userId, topic, log, onProgress, sendStepThinking ? (token: string) => sendStepThinking(step.id, token) : undefined);
              let round = 0;
              
              while (true) {
                  if (this.sessionManager.isSessionStopped(session.id)) {
                      log('[AutoResearch] Session stopped by user.');
                      output = `Auto-research completed/stopped. Stopped by user after ${round} rounds. Final content length: ${currentContent.length}.`;
                      break;
                  }

                  if (maxRounds && round >= maxRounds) {
                      output = `Auto-research completed/stopped. Completed after ${round} rounds. Final content length: ${currentContent.length}.`;
                      break;
                  }

                  round++;

                  log(`[AutoResearch] Round ${round}: Analyzing and improving...`);
                  
                  // 1. Plan Improvement
                  const improvePrompt = `
You are optimizing a research report on "${topic}".
Current Round: ${round}
Current Content Length: ${currentContent.length} chars.

Goal: Identify ONE specific area to improve (e.g., "Add recent statistics", "Explain concept X better", "Find a case study").
Return ONLY the improvement task description.
`;
                  
                  // Use stream for thinking if available
                  let improvementTask = '';
                  if (this.llm.chatStream && sendStepThinking) {
                      sendStepThinking(step.id, `\n\n> **Round ${round} Improvement Planning**\n`);
                      await this.llm.chatStream([{ role: 'user', content: improvePrompt }], {
                          onThinking: (token) => {
                              sendStepThinking(step.id, token);
                          },
                          onToken: (token) => {
                              improvementTask += token;
                              sendStepThinking(step.id, token);
                          }
                      });
                  } else {
                      const planRes = await this.llm.chat([{ role: 'user', content: improvePrompt }]);
                      improvementTask = planRes.content.trim();
                  }
                  
                  log(`[AutoResearch] Improvement Task: ${improvementTask}`);
                  
                  // Check stop signal again before expensive operations
                  if (this.sessionManager.isSessionStopped(session.id)) {
                      output = `Auto-research completed/stopped. Stopped by user after ${round} rounds. Final content length: ${currentContent.length}.`;
                      break;
                  }

                  // 2. Execute Improvement (Simulated via LLM or Skill)
                  const refinePrompt = `
You are an expert researcher.
Topic: ${topic}
Current Content:
${currentContent}

Task: ${improvementTask}

Action: Perform the task and rewrite the FULL content to include the new information. Make it better, more detailed, and academic.
`;
                  let refinedContent = '';
                  if (this.llm.chatStream && sendStepThinking) {
                       sendStepThinking(step.id, `\n\n> **Executing Improvement: ${improvementTask}**\n`);
                       await this.llm.chatStream([{ role: 'user', content: refinePrompt }], {
                           onThinking: (token) => {
                               sendStepThinking(step.id, token);
                           },
                           onToken: (token) => {
                               refinedContent += token;
                               sendStepThinking(step.id, token);
                           }
                       });
                  } else {
                       const refineRes = await this.llm.chat([{ role: 'user', content: refinePrompt }]);
                       refinedContent = refineRes.content;
                  }

                  currentContent = refinedContent;
                  
                  // 3. Generate Intermediate PDF
                  const title = `${topic} - v${round}`;
                  log(`[AutoResearch] Generating PDF version ${round}...`);
                  const pdfRes = await this.skillManager.executeSkill('pdf_generator', userId, { title, content: currentContent, sessionId: session.id }, skillHandlers);
                  
                  if (pdfRes.url && pdfRes.file_path) {
                       const url = pdfRes.url.startsWith('/') ? pdfRes.url : `/${pdfRes.url}`;
                       const artifact = {
                           id: `file-${Date.now()}`,
                           name: `${title}.pdf`,
                           type: 'file',
                           url: `${this.getGatewayBaseUrl()}${url}`,
                           path: pdfRes.file_path,
                           mimeType: 'application/pdf'
                       };
                       artifacts.push(artifact);
                       accumulatedArtifacts.push(artifact); // Add to global list
                       
                       // Send intermediate update to chat
                       this.sessionManager.addMessage(session.id, 'assistant', `[AUTO] Round ${round} Complete: I have improved the document based on "${improvementTask}".\n\n[Download ${title}.pdf](${artifact.url})`, { attachments: [artifact], auto: true });
                  }
                  
                  // Small delay to prevent tight loop if LLM is very fast, and allow stop signal processing
                  if (shouldDelay) {
                      await new Promise(resolve => setTimeout(resolve, maxRounds ? 500 : 2000));
                  }
              }
              break;
          case 'Chat': {
              const history = this.sessionManager.getHistory(session.id, 10);
              const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
              const context = await this.memoryManager.getFormattedMemories(userId, step.params.message);
              
              let artifactContext = '';
              if (accumulatedArtifacts.length > 0) {
                  artifactContext = `
[SYSTEM NOTICE] 
The following files have been generated and are attached to this response:
${accumulatedArtifacts.map(a => `- ${a.name} (${a.url})`).join('\n')}

IMPORTANT INSTRUCTIONS FOR YOUR REPLY:
1. You MUST explicitly mention that you have generated these files.
2. You MUST include a markdown link to the file in your response using the format: [Filename.pdf](URL)
3. Do not just say "I have attached the file", but provide the clickable link in the text.
`;
              }

              let reply = '';
              const messages = [
                  { role: 'system', content: `You are Redigg. Context: ${context}\n\nSession History:\n${historyText}${artifactContext}` },
                  { role: 'user', content: step.params.message }
              ];

              if (this.llm.chatStream && onProgress) {
                  await this.llm.chatStream(messages as any, {
                      onThinking: (token) => {
                          onProgress('thinking', token);
                      },
                      onToken: (token) => {
                          reply += token;
                          onProgress('token', token);
                      }
                  });
              } else {
                  const response = await this.llm.chat(messages as any);
                  reply = response.content;
                  usage = response.usage;
                  // Ensure UI gets the content if non-streaming
                  onProgress?.('token', reply);
              }
              
              // Attach accumulated artifacts to the final chat message
              const metadata = accumulatedArtifacts.length > 0 ? { attachments: accumulatedArtifacts } : undefined;
              this.sessionManager.addMessage(session.id, 'assistant', reply, metadata);
              output = reply;
              break;
          }
          default:
              throw new Error(`Unknown tool: ${step.tool}`);
      }

      return { output, artifacts, usage };
  }

  private resolvePdfGeneratorContent(session: Session, plannedContent: unknown, planSteps: any[] = []): string {
      const normalizedPlannedContent = typeof plannedContent === 'string' ? plannedContent.trim() : '';
      if (this.isUsablePdfContent(normalizedPlannedContent)) {
          return normalizedPlannedContent;
      }

      const previousStepContent = [...planSteps]
          .filter(candidate => candidate.status === 'completed' && typeof candidate.result === 'string')
          .map(candidate => String(candidate.result).trim())
          .reverse()
          .find(candidate => this.isUsablePdfContent(candidate));

      if (previousStepContent) {
          return previousStepContent;
      }

      const lastAssistantContent = [...this.sessionManager.getHistory(session.id, 20)]
          .reverse()
          .find(message => message.role === 'assistant' && this.isUsablePdfContent(message.content))
          ?.content
          ?.trim();

      if (lastAssistantContent) {
          return lastAssistantContent;
      }

      return normalizedPlannedContent || 'Generated based on literature review findings.';
  }

  private isUsablePdfContent(content: string): boolean {
      const normalized = content.trim();
      if (normalized.length < 120) {
          return false;
      }

      const lower = normalized.toLowerCase();
      const placeholderPhrases = [
          'generated based on literature review findings',
          'use the previous output',
          'use previous output',
          'same as above',
          'previous step output',
          'summarizing the key findings',
          'based on the literature review findings'
      ];

      return !placeholderPhrases.some(phrase => lower.includes(phrase));
  }

  private async buildAutoResearchInitialDraft(
      session: Session,
      userId: string,
      topic: string,
      log: (c: string, stats?: any) => void,
      onProgress?: AgentProgressHandler,
      onThinking?: (token: string) => void
  ): Promise<string> {
      log(`[AutoResearch] Building initial survey draft with academic_survey_self_improve...`);

      try {
          const result = await this.skillManager.executeSkill(
              'academic_survey_self_improve',
              userId,
              { topic, depth: 'standard' },
              {
                  onLog: (type: any, content: string) => {
                      if (type === 'thinking' && onThinking) {
                          onThinking(content);
                      } else {
                          log(`[AutoResearch][Seed] ${content}`);
                      }
                  },
                  onProgress: async (progress: number, description: string, metadata?: any) => {
                      log(`[AutoResearch][Seed] ${progress}% - ${description}`, metadata);
                  },
                  onTodo: async (content: string, priority: string) => {
                      onProgress?.('todo', {
                          id: `auto-seed-${Date.now()}`,
                          status: 'pending',
                          content,
                          priority
                      });
                  }
              }
          );

          const initialContent = typeof result.formatted_output === 'string' && result.formatted_output.trim()
              ? result.formatted_output
              : typeof result.summary === 'string'
                  ? result.summary
                  : '';

          if (initialContent.trim()) {
              log('[AutoResearch] Initial survey draft ready.', {
                  papers: Array.isArray(result.papers) ? result.papers.length : 0,
                  sections: Array.isArray(result.sections) ? result.sections.length : 0,
                  quality: result.quality_report?.overallScore ?? null
              });
              return initialContent;
          }

          throw new Error('Survey skill returned empty content.');
      } catch (error) {
          logger.error('[AutoResearch] Failed to build initial survey draft:', error);
          log('[AutoResearch] Falling back to placeholder draft because survey seed generation failed.');
          return `Initial draft for ${topic}.`;
      }
  }
  
  private async handlePostProcessing(
      session: Session, 
      userId: string, 
      message: string, 
      reply: string, 
      log: (c: string) => void,
      onProgress?: AgentProgressHandler
  ) {
    // Evolve Memory (Async)
    try {
        // DISABLED: Memory Evolution via LLM to save tokens as per user request.
        // const result = await this.memoryEvo.evolve(userId, message, reply, (msg) => log(msg));
        // if (result && result.added && result.added.length > 0) {
        //     log(`[Evolution] Extracted ${result.added.length} new memories.`);
        //     result.added.forEach((m: any) => {
        //         log(`[Evolution] New Memory: "${m.content}" (${m.type}/${m.tier})`);
        //     });
        //     // Silent execution: no chat message for memory updates
        // }
        // if (result && result.updated && result.updated.length > 0) {
        //      log(`[Evolution] Updated ${result.updated.length} memories.`);
        //      result.updated.forEach((m: any) => {
        //         log(`[Evolution] Updated Memory: "${m.content}" (${m.type}/${m.tier})`);
        //      });
        // }

        // Trigger memory consolidation immediately after new interaction
        // This handles background organization (pruning/promotion) without extra LLM extraction calls
        await this.memoryManager.consolidateMemories(userId).then(() => {
             // logger.debug('Post-chat consolidation complete');
        }).catch(e => {
             logger.error('Post-chat consolidation failed', e);
        });

        // After response and memory evolution, generate a title for the session if it's still generic
        const dialogueTurns = session.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
        if (dialogueTurns <= 4 && (session.title || '').length > 20) { // Early in convo or long default title
            const title = await this.generateSessionTitle(session, message, reply);
            if (title) {
                session.title = title;
                onProgress?.('session_title', { title, sessionId: session.id });
                onProgress?.('token', `[TITLE_GENERATED]${title}`);
            }
        }
    } catch (err) {
      logger.error('Memory evolution failed:', err);
    }
  }

  public async executeLegacyLogic(
    session: Session,
    userId: string, 
    message: string, 
    log: (content: string, stats?: any) => void,
    onProgress?: AgentProgressHandler
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
        return this.executeLiteratureReview(session, userId, topic, log, onProgress);
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
             
             return this.executeLiteratureReview(session, userId, decision.topic, log, onProgress);
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
            onThinking: (token) => {
                onProgress('thinking', token);
            },
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
        // Call onProgress in non-streaming fallback to show tokens in UI
        onProgress?.('token', reply);
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

  private async executeLiteratureReview(
      session: Session, 
      userId: string, 
      topic: string, 
      log: (content: string, stats?: any) => void,
      onProgress?: AgentProgressHandler,
      onThinking?: (token: string) => void
  ): Promise<string> {
    logger.info(`Detected intent: Literature Review on "${topic}"`);
    const startTime = Date.now();
    log(`[Agent] Detected intent: Literature Review (Web Search) on "${topic}"`);
    
    try {
      const result = await this.skillManager.executeSkill(
        'academic_survey_self_improve', 
        userId, 
        { topic },
        {
            onLog: (type, content) => {
                if (type === 'thinking' && onThinking) {
                    onThinking(content);
                } else {
                    log(`[Skill] ${content}`);
                }
            },
            onProgress: async (progress, description, metadata) => {
                 log(`[Skill Progress] ${progress}% - ${description}`, metadata);
                 if (metadata && metadata.papers) {
                     // Emit todo/progress update for UI
                     onProgress?.('todo', { 
                         id: 'research-progress', 
                         type: 'research',
                         status: 'in_progress', 
                         content: `Found ${metadata.papers.length} papers`, 
                         metadata: metadata 
                     });
                 }
            },
            onTodo: async (content, priority, step) => {
                onProgress?.('todo', {
                    id: `skill-todo-${Date.now()}`,
                    status: 'pending',
                    content,
                    priority
                });
            }
        }
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
