import { MemoryManager } from '../memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../memory/evolution/MemoryEvolutionSystem.js';
import { SkillEvolutionSystem } from '../skills/builtin/agent/evolution/SkillEvolutionSystem.js';
import { LLMClient } from '../llm/LLMClient.js';
import { SkillManager } from '../skills/SkillManager.js';
import { SessionManager, Session } from '../session/SessionManager.js';
import { CronManager } from '../scheduling/CronManager.js';
import { EventManager } from '../events/EventManager.js';
import { QualityManager } from '../quality/QualityManager.js';
import { createLogger } from '../utils/logger.js';
import type { AgentProgressHandler } from '../protocol/progress.js';
import { ensureSessionWorkspace } from '../workspace/sessionWorkspace.js';
import path from 'path';

// Built-in Core Skills
import LocalFileSkill from '../skills/builtin/system/local-file-ops/index.js';
import CodeAnalysisSkill from '../skills/builtin/system/code-analysis/index.js';
import BrowserControlSkill from '../skills/builtin/system/browser-control/index.js';
import GetCurrentTimeSkill from '../skills/builtin/system/get-current-time/index.js';
import ShellSkill from '../skills/builtin/system/shell/index.js';

// Built-in Agent/System Skills
import OrchestrationSkill from '../skills/builtin/agent/agent-orchestration/index.js';
import EvolutionSkill from '../skills/builtin/agent/evolution/index.js';
import HeartbeatSkill from '../skills/builtin/agent/heartbeat/index.js';
import MemoryManagementSkill from '../skills/builtin/agent/memory-management/index.js';
import MemorySearchSkill from '../skills/builtin/agent/memory-search/index.js';
import SchedulingSkill from '../skills/builtin/agent/scheduling/index.js';
import SessionManagementSkill from '../skills/builtin/agent/session-management/index.js';
import SkillManagementSkill from '../skills/builtin/agent/skill-management/index.js';

// Research Tools (Phase 1-4)
import PaperSearchSkill from '../../skills/01-literature/paper-search/index.js';
import PaperReaderSkill from '../../skills/01-literature/paper-reader/index.js';
import BibtexManagerSkill from '../../skills/01-literature/bibtex-manager/index.js';
import LiteratureReviewSkill from '../../skills/01-literature/literature-review/index.js';
import PaperSummarizerSkill from '../../skills/01-literature/paper-summarizer/index.js';

import HypothesisGeneratorSkill from '../../skills/02-idea/hypothesis-generator/index.js';
import GapAnalyzerSkill from '../../skills/02-idea/gap-analyzer/index.js';

import DataAnalysisSkill from '../../skills/03-experiment/data-analysis/index.js';
import PlotGeneratorSkill from '../../skills/03-experiment/plot-generator/index.js';

import LatexHelperSkill from '../../skills/04-paper/latex-helper/index.js';
import PdfGeneratorSkill from '../../skills/04-paper/pdf-generator/index.js';
import FigureGeneratorSkill from '../../skills/04-paper/figure-generator/index.js';

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
    this.sessionManager = new SessionManager(memoryManager.storage);
    this.cronManager = new CronManager();
    this.eventManager = new EventManager();
    this.qualityManager = new QualityManager(llm);
    
    this.skillManager = skillManager || new SkillManager(
      llm, 
      memoryManager, 
      path.join(process.cwd(), 'workspace'),
      undefined,
      path.join(process.cwd(), 'src', 'skills', 'builtin')
    );

    // Register built-in skills directly (bypassing file system discovery)
    if (!this.skillManager.getSkill('local_file_ops')) {
        this.skillManager.registerSkill(new LocalFileSkill());
    }
    if (!this.skillManager.getSkill('code_analysis')) {
        this.skillManager.registerSkill(new CodeAnalysisSkill());
    }
    if (!this.skillManager.getSkill('pdf_generator')) {
        this.skillManager.registerSkill(new PdfGeneratorSkill());
    }
    
    // Research Tools
    if (!this.skillManager.getSkill('paper_search')) {
        this.skillManager.registerSkill(new PaperSearchSkill());
    }
    if (!this.skillManager.getSkill('paper_reader')) {
        this.skillManager.registerSkill(new PaperReaderSkill());
    }
    if (!this.skillManager.getSkill('paper_summarizer')) {
        this.skillManager.registerSkill(new PaperSummarizerSkill());
    }
    if (!this.skillManager.getSkill('bibtex_manager')) {
        this.skillManager.registerSkill(new BibtexManagerSkill());
    }
    if (!this.skillManager.getSkill('browser_control')) {
        this.skillManager.registerSkill(new BrowserControlSkill());
    }
    if (!this.skillManager.getSkill('data_analysis')) {
        this.skillManager.registerSkill(new DataAnalysisSkill());
    }
    if (!this.skillManager.getSkill('get_current_time')) {
        this.skillManager.registerSkill(new GetCurrentTimeSkill());
    }
    if (!this.skillManager.getSkill('latex_helper')) {
        this.skillManager.registerSkill(new LatexHelperSkill());
    }
    if (!this.skillManager.getSkill('memory_search')) {
        this.skillManager.registerSkill(new MemorySearchSkill());
    }
    if (!this.skillManager.getSkill('plot_generator')) {
        this.skillManager.registerSkill(new PlotGeneratorSkill());
    }
    if (!this.skillManager.getSkill('shell')) {
        this.skillManager.registerSkill(new ShellSkill());
    }

    // Register Extensible Skills manually for now (until dynamic loading handles the paths correctly)
    if (!this.skillManager.getSkill('literature_review')) {
        this.skillManager.registerSkill(new LiteratureReviewSkill());
    }

    if (!this.skillManager.getSkill('hypothesis_generator')) {
        this.skillManager.registerSkill(new HypothesisGeneratorSkill());
    }
    if (!this.skillManager.getSkill('gap_analyzer')) {
        this.skillManager.registerSkill(new GapAnalyzerSkill());
    }

    if (!this.skillManager.getSkill('data_analysis')) {
        this.skillManager.registerSkill(new DataAnalysisSkill());
    }
    
    // Agent / System Skills
    if (!this.skillManager.getSkill('agent_orchestration')) {
        this.skillManager.registerSkill(new OrchestrationSkill());
    }
    if (!this.skillManager.getSkill('skill_evolution')) {
        this.skillManager.registerSkill(new EvolutionSkill());
    }
    if (!this.skillManager.getSkill('heartbeat')) {
        this.skillManager.registerSkill(new HeartbeatSkill());
    }
    if (!this.skillManager.getSkill('memory_management')) {
        this.skillManager.registerSkill(new MemoryManagementSkill());
    }
    if (!this.skillManager.getSkill('scheduling')) {
        this.skillManager.registerSkill(new SchedulingSkill());
    }
    if (!this.skillManager.getSkill('session_management')) {
        this.skillManager.registerSkill(new SessionManagementSkill());
    }
    if (!this.skillManager.getSkill('skill_management')) {
        this.skillManager.registerSkill(new SkillManagementSkill());
    }
    
    this.skillManager.setManagers({
        cron: this.cronManager,
        session: this.sessionManager,
        skill: this.skillManager,
        event: this.eventManager,
    });
    
    this.skillEvo = new SkillEvolutionSystem(this.skillManager, llm);
    
    this.skillManager.loadSkillsFromDisk().catch(err => {
        logger.error('Failed to load skills from disk:', err);
    });
  }

  private heartbeatRunInFlight = false;
  private heartbeatRunQueued = false;
  private heartbeatRunTimer: NodeJS.Timeout | null = null;

  private queueHeartbeatRun(delayMs: number = 5000) {
    if (process.env.NODE_ENV === 'test') return;
    this.heartbeatRunQueued = true;
    if (this.heartbeatRunTimer) return;

    this.heartbeatRunTimer = setTimeout(() => {
      this.heartbeatRunTimer = null;
      void this.runHeartbeatLoop();
    }, delayMs);
  }

  private async runHeartbeatLoop() {
    if (this.heartbeatRunInFlight) return;
    this.heartbeatRunInFlight = true;
    try {
      while (this.heartbeatRunQueued) {
        this.heartbeatRunQueued = false;
        await this.heartbeat();
      }
    } finally {
      this.heartbeatRunInFlight = false;
    }
  }

  public async start() {
    logger.info('Agent started.');
  }

  public stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async heartbeat() {
    try {
        if (this.skillManager.getSkill('heartbeat')) {
            await this.skillManager.executeSkill('heartbeat', 'system', {});
        }
    } catch (e) {
        logger.error('Heartbeat skill failed:', e);
    }
  }

  private buildToolsArray() {
    return this.skillManager.getAllSkills()
      .filter(s => !s.tags?.includes('declarative'))
      .map(skill => {
        // Safe tool name for OpenAI
        const safeName = skill.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        return {
          type: 'function' as const,
          function: {
            name: safeName,
            description: skill.description || `Execute ${skill.name}`,
            parameters: skill.parameters || {
              type: 'object',
              properties: {
                params: {
                  type: 'object',
                  description: 'Dynamic parameters for this skill based on its description.'
                }
              },
              additionalProperties: true
            }
          }
        };
      });
  }

  public async chat(
    userId: string, 
    message: string, 
    onProgress?: AgentProgressHandler,
    sessionId?: string
  ): Promise<string> {
    logger.info(`[Chat] Starting chat for user ${userId}, message: ${message.substring(0, 100)}...`);
    const startTime = Date.now();
    
    const log = (content: string, stats?: any) => {
      const payload = stats ? `${content}__STATS__${JSON.stringify(stats)}` : content;
      onProgress?.('log', payload);
      if (stats) onProgress?.('stats', stats);
      this.sessionManager.addMessage(session.id, 'log', payload);
      logger.info(`[ChatLog] ${content}`);
    };

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
    
    logger.info(`[Chat] Session: ${session.id}`);
    this.sessionManager.activateSession(session.id);
    this.sessionManager.setSessionStatus(session.id, 'running');
    
    let finalReply = '';
    const accumulatedArtifacts: any[] = [];

    try {
        await ensureSessionWorkspace(session.id);
        if (session.messages.length === 0) {
            session.title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        }

        this.sessionManager.addMessage(session.id, 'user', message);

        const tools = this.buildToolsArray();
        const memories = await this.memoryManager.getFormattedMemories(userId, message);
        
        // System Prompt
        const systemPrompt = `You are Redigg, an advanced autonomous research agent.
You have access to a variety of tools (skills). You can call multiple tools sequentially or in parallel.
If the user asks to analyze code, use 'code_analysis'.
If the user asks to manage files, use 'local_file_ops'.
If the user asks to generate a PDF, use 'pdf_generator'.

Context & Preferences:
${memories || 'No prior context.'}

IMPORTANT:
- Think step by step. If you need information, use tools.
- When you are done, summarize your findings directly to the user.
- If a tool generates a file (like PDF), include a markdown link to it in your final response: [Filename.pdf](/url/path).`;

        // Gather history
        const historyMsgs = this.sessionManager.getHistory(session.id, 10)
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }));

        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          ...historyMsgs,
          { role: 'user', content: message }
        ];

        const MAX_STEPS = 15;
        let stepCount = 0;
        let isDone = false;

        onProgress?.('segment', { id: 'planning', type: 'thinking', title: 'Planning', status: 'active' });

        let lastStreamText = '';
        while (stepCount < MAX_STEPS && !isDone) {
          if (this.sessionManager.isSessionStopped(session.id)) {
            log('[Agent] Session stopped by user.');
            finalReply = 'I stopped the task as requested.';
            break;
          }
          
          stepCount++;
          log(`[Agent] Step ${stepCount}: Generating thought/action...`);

          let streamText = '';
          let toolCalls: any[] | undefined = undefined;

          // Call LLM
          logger.info(`[Chat] Calling LLM, step ${stepCount}...`);
          const llmStartTime = Date.now();
          
          if (this.llm.chatStream && onProgress) {
             await this.llm.chatStream(messages, {
                onToken: (t) => { streamText += t; onProgress('token', t); },
                onThinking: (t) => { onProgress('thinking', t); },
                onToolCallStart: (tc) => {
                   log(`[Agent] Decided to use tool: ${tc.function.name}`);
                   onProgress('todo', { id: tc.id, status: 'in_progress', content: `Using tool: ${tc.function.name}` });
                },
                onComplete: (text, tc) => { toolCalls = tc; }
             }, { tools });
             logger.info(`[Chat] LLM stream completed in ${Date.now() - llmStartTime}ms`);
          } else {
             const res = await this.llm.chat(messages, { tools });
             streamText = res.content;
             toolCalls = res.tool_calls;
             if (streamText) onProgress?.('token', streamText);
          }
          
          // Fallback: parse text-based tool calls if the model failed to use native tool calling
          if ((!toolCalls || toolCalls.length === 0) && streamText) {
             const toolCallRegex = /<tool_call>\s*([a-zA-Z0-9_-]+)\s*\(?\s*(\{[\s\S]*?(?=\)?\s*(?:<tool_call>|$)))/g;
             const nakedCallRegex = /([a-zA-Z0-9_-]+)\s*\(\s*([a-zA-Z0-9_-]+\s*=\s*[\s\S]*?)\s*\)/g;
             
             let match;
             const extractedTools = [];
             
             // First try <tool_call> tag format
             while ((match = toolCallRegex.exec(streamText)) !== null) {
                 extractedTools.push({
                     id: `call_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                     type: 'function',
                     function: {
                         name: match[1],
                         arguments: match[2]
                     }
                 });
             }
             
             // If still empty, try naked python-style function calls (e.g. tool_name(query="..."))
             if (extractedTools.length === 0) {
                 // Reset regex state just in case
                 nakedCallRegex.lastIndex = 0;
                 while ((match = nakedCallRegex.exec(streamText)) !== null) {
                     const funcName = match[1];
                     const argsStr = match[2];
                     
                     // Only accept if funcName matches a known tool
                     if (tools.some(t => t.function.name === funcName)) {
                         // Very basic kwarg to JSON converter for fallback
                         const argsJson: any = {};
                         // A slightly more robust parser for naked args
                         const pairs = argsStr.split(/,\s*(?=[a-zA-Z0-9_]+\s*=)/);
                         pairs.forEach(part => {
                             const eqIdx = part.indexOf('=');
                             if (eqIdx > -1) {
                                 const k = part.slice(0, eqIdx).trim();
                                 let val = part.slice(eqIdx + 1).trim();
                                 if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                                 else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
                                 argsJson[k] = val;
                             }
                         });
                         
                         extractedTools.push({
                             id: `call_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                             type: 'function',
                             function: {
                                 name: funcName,
                                 arguments: JSON.stringify(argsJson)
                             }
                         });
                     }
                 }
             }
             
             if (extractedTools.length > 0) {
                 toolCalls = extractedTools;
             }
          }

          // Clean up the text so we don't show the raw tool call to the user
          streamText = streamText.replace(/<tool_call>[\s\S]*$/, '').trim();
          streamText = streamText.replace(/([a-zA-Z0-9_-]+)\s*\(\s*([a-zA-Z0-9_-]+\s*=\s*[\s\S]*?)\s*\)/g, '').trim();
          
          // Strip <think> tags from the final text so it doesn't clutter the history
          streamText = streamText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          streamText = streamText.replace(/<think>[\s\S]*/g, '').trim(); // in case it was unclosed
          
          // Fallback strip tool tags entirely if any remain
          streamText = streamText.replace(/<tool_call>[\s\S]*$/, '').trim();

          lastStreamText = streamText;

          // Append assistant message
          messages.push({
            role: 'assistant',
            content: streamText,
            tool_calls: toolCalls
          });

          if (!toolCalls || toolCalls.length === 0) {
            // No tools called, we are done!
            finalReply = streamText;
            isDone = true;
            break;
          }

          // Execute tools
          for (const tc of toolCalls) {
             if (this.sessionManager.isSessionStopped(session.id)) break;

             const toolName = tc.function.name;
             const toolArgs = tc.function.arguments;
             let parsedArgs: any = {};
             try { parsedArgs = JSON.parse(toolArgs); } catch (e) {}

             // Unpack wrapper if needed
             if (parsedArgs.params && Object.keys(parsedArgs).length === 1) {
                 parsedArgs = parsedArgs.params;
             }

             onProgress?.('tool_call', {
               id: tc.id,
               tool: toolName,
               input: parsedArgs,
               ts: Date.now(),
             });

             log(`[Skill:${toolName}] Executing with args: ${JSON.stringify(parsedArgs)}`);
             
             let toolResultStr = '';
             try {
                // Find original skill ID (un-safed)
                const skill = this.skillManager.getAllSkills().find(s => s.id.replace(/[^a-zA-Z0-9_-]/g, '_') === toolName);
                if (!skill) throw new Error(`Skill ${toolName} not found`);

                const result = await this.skillManager.executeSkill(skill.id, userId, parsedArgs, {
                  onLog: (type, content, metadata) => {
                     const text = typeof content === 'string' ? content : (() => {
                       try { return JSON.stringify(content); } catch { return String(content); }
                     })();

                     if (type === 'thinking') {
                       onProgress?.('thinking', text);
                       return;
                     }

                     if (type === 'tool_call') {
                       onProgress?.('tool_call', {
                         id: metadata?.id || `skill-${toolName}-${Date.now()}`,
                         tool: metadata?.tool || String(metadata?.name || text || toolName),
                         input: metadata?.input ?? metadata?.params ?? metadata ?? text,
                         ts: Date.now(),
                       });
                       return;
                     }

                     if (type === 'tool_result') {
                       const ok = typeof metadata?.ok === 'boolean' ? metadata.ok : metadata?.isError ? false : true;
                       onProgress?.('tool_result', {
                         id: metadata?.id || `skill-${toolName}-${Date.now()}`,
                         tool: metadata?.tool || String(metadata?.name || text || toolName),
                         ok,
                         output: metadata?.output ?? metadata?.result ?? metadata ?? text,
                         ts: Date.now(),
                       });
                       return;
                     }

                     if (type === 'error') {
                       log(`[Skill:${toolName}] Error: ${text}`);
                       return;
                     }

                     log(`[Skill:${toolName}] ${text}`);
                  },
                  onProgress: async (p, desc) => {
                     onProgress?.('todo', { id: tc.id, status: 'in_progress', content: `[${toolName}] ${desc}` });
                  }
                });

                // Extract artifacts if it's pdf_generator
                if (toolName === 'pdf_generator' && result.url && result.file_path) {
                    const url = result.url.startsWith('/') ? result.url : `/${result.url}`;
                    accumulatedArtifacts.push({
                        id: `file-${Date.now()}`,
                        name: parsedArgs.title ? `${parsedArgs.title}.pdf` : 'document.pdf',
                        type: 'file',
                        url: `${this.getGatewayBaseUrl()}${url}`,
                        path: result.file_path,
                        mimeType: 'application/pdf'
                    });
                }

                toolResultStr = typeof result === 'string' ? result : 
                                typeof result.formatted_output === 'string' ? result.formatted_output : 
                                typeof result.summary === 'string' ? result.summary : JSON.stringify(result);

                onProgress?.('tool_result', {
                  id: tc.id,
                  tool: toolName,
                  ok: true,
                  output: toolResultStr.length > 8000 ? `${toolResultStr.slice(0, 8000)}\n...[truncated]...` : toolResultStr,
                  ts: Date.now(),
                });
                
                onProgress?.('todo', { id: tc.id, status: 'completed', content: `Finished: ${toolName}` });
                log(`[Skill:${toolName}] Success`);
             } catch (err: any) {
                logger.error(`[Skill:${toolName}] Error:`, err);
                toolResultStr = `Error executing tool: ${err.message || String(err)}`;

                onProgress?.('tool_result', {
                  id: tc.id,
                  tool: toolName,
                  ok: false,
                  output: toolResultStr,
                  ts: Date.now(),
                });
                onProgress?.('todo', { id: tc.id, status: 'failed', content: `Failed: ${toolName}` });
                log(`[Skill:${toolName}] Error: ${err.message}`);
             }

             messages.push({
               role: 'tool',
               tool_call_id: tc.id,
               content: toolResultStr
             });
          }
        }

        if (stepCount >= MAX_STEPS) {
           log('[Agent] Max steps reached. Forcing completion.');
           finalReply = lastStreamText || 'Task interrupted due to step limit.';
        }

        onProgress?.('segment', { id: 'planning', type: 'thinking', title: 'Planning', status: 'completed' });

        const metadata = accumulatedArtifacts.length > 0 ? { attachments: accumulatedArtifacts } : undefined;
        this.sessionManager.addMessage(session.id, 'assistant', finalReply, metadata);

        // Background Consolidation
        void this.memoryManager.consolidateMemories(userId).catch(e => logger.error('Consolidation failed', e));

        if (session.messages.length <= 4 && (!session.title || session.title.length > 20)) {
           void this.generateSessionTitle(session, message, finalReply).then(t => {
               if (t) {
                   session.title = t;
                   onProgress?.('token', `\n[TITLE_GENERATED]${t}`);
               }
           });
        }

        return finalReply;
    } finally {
        if (!this.sessionManager.isSessionStopped(session.id)) {
            this.sessionManager.setSessionStatus(session.id, 'active');
        }
        // DISABLED: heartbeat is not needed for now
        // this.queueHeartbeatRun();
    }
  }

  private async generateSessionTitle(session: Session, userMsg: string, agentMsg: string): Promise<string | null> {
      try {
          const prompt = `Summarize the following conversation into a short, 3-5 word title. Do not use quotes.\nUser: ${userMsg}\nAgent: ${agentMsg}\nTitle:`;
          const response = await this.llm.chat([{ role: 'user', content: prompt }]);
          return response.content.trim();
      } catch (e) {
          return null;
      }
  }
}
