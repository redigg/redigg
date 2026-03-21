import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AgentCard, Message, AGENT_CARD_PATH } from '@a2a-js/sdk';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  InMemoryTaskStore,
} from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { ResearchAgent } from '../agent/ResearchAgent.js';
import { createLogger } from '../utils/logger.js';

import { EventEmitter } from 'events';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { fileURLToPath } from 'url';
import { ensureSessionWorkspace, getSessionWorkspacePaths } from '../workspace/sessionWorkspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('Gateway');
const sessionEvents = new EventEmitter(); // Bus for streaming events to SSE clients

const storage = multer.diskStorage({
  destination: function (req, _file, cb) {
    try {
      const sessionId = (req.body as any)?.sessionId || (req.query as any)?.sessionId;
      if (typeof sessionId === 'string' && sessionId.trim()) {
        const dirs = getSessionWorkspacePaths(sessionId.trim());
        fs.mkdirSync(dirs.uploadsDir, { recursive: true });
        cb(null, dirs.uploadsDir);
        return;
      }
    } catch {}

    const fallbackDir = path.join(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    cb(null, fallbackDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage });

export class A2AGateway {
  private app: express.Express;
  private port: number;
  private agent: ResearchAgent;
  private server: Server | null = null;
  private agentCard: AgentCard | null = null;

  constructor(agent: ResearchAgent, port: number = 4000) {
    this.agent = agent;
    this.port = port;
    this.app = express();
    this.setupA2A();
  }

  private setupA2A() {
    const agentCard: AgentCard = {
      name: 'Redigg Research Agent',
      description: 'An autonomous research agent that helps with literature review and scientific discovery.',
      protocolVersion: '0.3.0',
      version: '0.1.0',
      url: `http://localhost:${this.port}/a2a/jsonrpc`,
      skills: [
        { 
          id: 'chat', 
          name: 'Research Chat', 
          description: 'Chat with the research agent about scientific topics', 
          tags: ['research', 'chat'] 
        },
        {
          id: 'literature_review',
          name: 'Literature Review',
          description: 'Search for papers and generate a literature review',
          tags: ['research', 'literature', 'review']
        }
      ],
      capabilities: {
        pushNotifications: false,
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      additionalInterfaces: [
        { url: `http://localhost:${this.port}/a2a/jsonrpc`, transport: 'JSONRPC' },
        { url: `http://localhost:${this.port}/a2a/rest`, transport: 'HTTP+JSON' },
      ],
    };

    this.agentCard = agentCard;

    const executor: AgentExecutor = {
      execute: async (requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> => {
        const task = requestContext.task;
        const userMessageFromRequest = requestContext.userMessage;
        let userMessage = '';
        let input: any = null;

        if (task) {
          input = (task as any).input;
        }

        if (userMessageFromRequest && userMessageFromRequest.parts && userMessageFromRequest.parts.length > 0) {
           const firstPart = userMessageFromRequest.parts[0] as any;
           userMessage = firstPart.text || '';
         }

        if (!userMessage && input) {
          if (typeof input === 'string') {
            userMessage = input;
          } else if (typeof input === 'object' && 'text' in input) {
            userMessage = (input as any).text;
          }
        }

        if (!userMessage) {
          userMessage = "Hello";
        }

        const userId = 'a2a-user';

        logger.info(`A2A Request: ${userMessage.substring(0, 100)}`);

        try {
          const reply = await this.agent.chat(userId, userMessage, (type, content) => {
            if (type === 'segment') {
              logger.info(`[Segment] ${content?.title || content?.id} - ${content?.status}`);
            } else if (type === 'log') {
              logger.info(`[Log] ${content}`);
            } else if (type === 'thinking') {
              process.stdout.write(content);
            } else if (type === 'token') {
              process.stdout.write(content as string);
            }
          });

          const responseMessage: Message = {
            kind: 'message',
            messageId: uuidv4(),
            role: 'agent',
            parts: [{ kind: 'text', text: reply }],
            contextId: requestContext.contextId,
          };

          eventBus.publish(responseMessage);
          eventBus.finished();
        } catch (error) {
          logger.error('A2A execution error:', error);
          const errorMessage: Message = {
            kind: 'message',
            messageId: uuidv4(),
            role: 'agent',
            parts: [{ kind: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            contextId: requestContext.contextId,
          };
          eventBus.publish(errorMessage);
          eventBus.finished();
        }
      },
      cancelTask: async () => {},
    };

    const requestHandler = new DefaultRequestHandler(
      agentCard,
      new InMemoryTaskStore(),
      executor
    );

    // CORS for local development (Must be first)
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    this.app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
    this.app.use('/a2a/jsonrpc', jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
    this.app.use('/a2a/rest', restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
    
    // Simple Chat API for Web Dashboard
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use('/files/sessions', express.static(path.join(process.cwd(), 'workspace', 'sessions')));
    this.app.use('/files', express.static(path.join(process.cwd(), 'workspace/output')));

    // Serve Frontend Static Files (Production Mode)
    // Check if web/dist exists (relative to current working directory or package root)
    // In production (npm package), dist/gateway/index.js is running.
    // web/dist should be at ../../web/dist relative to this file?
    // No, usually we look from process.cwd() or __dirname.
    // If installed globally, process.cwd() is where the user runs it.
    // So we need to find the package root.
    
    // Attempt to find web/dist
    let webDistPath = path.join(process.cwd(), 'web', 'dist'); // Local dev or if run from root
    if (!fs.existsSync(webDistPath)) {
        // Try finding it relative to the executable/module
        // In dist/src/gateway/index.js:
        // __dirname = .../dist/src/gateway
        // .. -> .../dist/src
        // .. -> .../dist
        // .. -> .../ (package root)
        // web/dist -> .../web/dist
        webDistPath = path.resolve(__dirname, '..', '..', '..', 'web', 'dist');
    }
    
    if (fs.existsSync(webDistPath)) {
        logger.info(`Serving frontend from ${webDistPath}`);
        this.app.use(express.static(webDistPath));
        
        // SPA Fallback
        this.app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/a2a')) {
                return next();
            }
            res.sendFile(path.join(webDistPath, 'index.html'));
        });
    } else {
        logger.warn(`Frontend build not found at ${webDistPath}. Dashboard may not be available.`);
    }
    
    // File Upload API
    // File Upload API
    this.app.post('/api/upload', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            const sessionId = (req.body as any)?.sessionId;
            if (typeof sessionId === 'string' && sessionId.trim()) {
              await ensureSessionWorkspace(sessionId.trim());
            }
            logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

            let url: string | undefined;
            if (typeof sessionId === 'string' && sessionId.trim()) {
              url = `/files/sessions/${sessionId.trim()}/uploads/${req.file.filename}`;
            }

            res.json({
                id: req.file.filename,
                name: req.file.originalname,
                path: req.file.path,
                url,
                size: req.file.size,
                mimetype: req.file.mimetype
            });
        } catch (error) {
            logger.error('Upload error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.post('/api/chat', async (req, res) => {
      const { message, userId = 'web-user' } = req.body;
      logger.info(`Chat request: ${message}`);
      try {
        let fullReply = '';
        const reply = await this.agent.chat(userId, message, (type, content) => {
          if (type === 'segment') {
             logger.info(`[Segment] ${content?.title || content?.id} - ${content?.status}`);
          } else if (type === 'thinking') {
             process.stdout.write(content);
          } else if (type === 'token') {
             process.stdout.write(content as string);
          } else if (type === 'log') {
             logger.info(`[Action] ${content}`);
          }
        });
        logger.info(`\n[Output] ${reply}`);
        res.json({ reply });
      } catch (error) {
        logger.error('Chat error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Skill API
    this.app.get('/api/skills', (req, res) => {
        try {
            const skillStats = this.agent.skillManager.getSkillStats();
            
            const skills = this.agent.skillManager.getAllSkills().map(s => {
                // Find which pack this skill belongs to
                const pack = this.agent.skillManager.getAllPacks().find(p => p.skills.some(sk => sk.id === s.id));
                // Find usage stats
                const usage = skillStats.skills.find((stat: any) => stat.id === s.id)?.usage;

                return {
                    id: s.id,
                    name: (s as any).name || s.id,
                    description: (s as any).description || '',
                    packId: pack?.id,
                    readme: (s as any).readme || null,
                    usage: usage || { used: 0, success: 0, failed: 0 }
                };
            });
            res.json(skills);
        } catch (error) {
            logger.error('Skills error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.get('/api/skill-packs', (req, res) => {
        try {
            const packs = this.agent.skillManager.getAllPacks().map(p => ({
                id: p.id,
                name: p.name,
                description: p.description
            }));
            res.json(packs);
        } catch (error) {
            logger.error('Skill packs error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    // Memory API
    this.app.get('/api/memories', async (req, res) => {
        const userId = (req.query.userId as string) || 'web-user';
        try {
            const memories = await this.agent.memoryManager.getUserMemories(userId);
            res.json(memories);
        } catch (error) {
            logger.error('Memories error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.delete('/api/memories/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await this.agent.memoryManager.deleteMemory(id);
            res.json({ success: true });
        } catch (error) {
            logger.error('Delete memory error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    // Session API
    this.app.get('/api/sessions', (req, res) => {
        const userId = (req.query.userId as string) || 'web-user';
        try {
            const sessions = this.agent.sessionManager.getUserSessions(userId);
            res.json(sessions);
        } catch (error) {
            logger.error('Sessions error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.post('/api/sessions', (req, res) => {
        const { userId = 'web-user', title } = req.body;
        try {
            const session = this.agent.sessionManager.createSession(userId, title);
            res.json(session);
        } catch (error) {
            logger.error('Create session error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.post('/api/sessions/:sessionId/stop', (req, res) => {
        const { sessionId } = req.params;
        try {
            this.agent.sessionManager.stopSession(sessionId);
            res.json({ success: true });
        } catch (error) {
            logger.error('Stop session error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.get('/api/sessions/:sessionId/history', (req, res) => {
        const { sessionId } = req.params;
        try {
            const history = this.agent.sessionManager.getHistory(sessionId, 100);
            res.json(history);
        } catch (error) {
            logger.error('Session history error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.delete('/api/sessions', (req, res) => {
        const userId = (req.query.userId as string) || 'web-user';
        try {
            const { deleted, sessionIds } = this.agent.sessionManager.deleteAllSessions(userId);
            for (const sessionId of sessionIds) {
                try {
                    fs.rmSync(path.join(process.cwd(), 'workspace', 'sessions', sessionId), { recursive: true, force: true });
                } catch {}
            }
            res.json({ success: true, deleted });
        } catch (error) {
            logger.error('Delete all sessions error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.delete('/api/sessions/:sessionId', (req, res) => {
        const { sessionId } = req.params;
        try {
            this.agent.sessionManager.deleteSession(sessionId);
            try {
                fs.rmSync(path.join(process.cwd(), 'workspace', 'sessions', sessionId), { recursive: true, force: true });
            } catch {}
            res.json({ success: true });
        } catch (error) {
            logger.error('Delete session error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    // Async Chat API
    this.app.post('/api/chat/async', (req, res) => {
        let { message, userId = 'web-user', sessionId, webSearch, attachments } = req.body;
        
        if (!message && (!attachments || attachments.length === 0)) {
            res.status(400).json({ error: 'Message or attachments required' });
            return;
        }

        // Process attachments context
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            message += `\n\n[ATTACHMENTS]\nThe user has uploaded the following files:\n${attachments.map((f: any) => `- ${f.name} (ID: ${f.id})`).join('\n')}\nYou can refer to these files in your response.`;
        }

        // Process web search context
        if (webSearch) {
            message = `[WEB SEARCH REQUEST] ${message}\nPlease perform a literature review or web search to answer this question.`;
        }
        
        logger.info(`Async Chat request: ${message} (Session: ${sessionId || 'auto'})`);

        // Start agent in background
        this.agent.chat(userId, message, (type, content) => {
            // Logs are now persisted by agent itself to DB, so we don't need to do anything here
            // BUT we want to broadcast via SSE/WebSocket for real-time updates.
            if (sessionId) {
                const shouldPersist = (() => {
                  if (
                    type === 'segment' ||
                    type === 'plan' ||
                    type === 'todo' ||
                    type === 'stats' ||
                    type === 'session_title' ||
                    type === 'error' ||
                    type === 'thinking' ||
                    type === 'log' ||
                    type === 'tool_call' ||
                    type === 'tool_result' ||
                    type === 'done'
                  ) {
                    return true;
                  }
                  if (type === 'token') {
                    const text = String(content || '');
                    return text.length <= 400 && text.includes('\n');
                  }
                  return false;
                })();

                const eventId = shouldPersist
                  ? this.agent.sessionManager.appendEvent(sessionId, type, content)
                  : null;

                sessionEvents.emit(`session:${sessionId}`, { id: eventId, type, content });
            }
        }, sessionId).catch(err => {
            logger.error('Async chat error:', err);
            if (sessionId) {
                const eventId = this.agent.sessionManager.appendEvent(sessionId, 'error', String(err));
                sessionEvents.emit(`session:${sessionId}`, { id: eventId, type: 'error', content: String(err) });
            }
        }).finally(() => {
            if (sessionId) {
                const eventId = this.agent.sessionManager.appendEvent(sessionId, 'done', null);
                sessionEvents.emit(`session:${sessionId}`, { id: eventId, type: 'done' });
            }
        });

        res.status(202).json({ status: 'accepted', message: 'Processing started' });
    });

    // Real-time Event Stream for a Session
    this.app.get('/api/sessions/:sessionId/events', (req, res) => {
        const { sessionId } = req.params;
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const lastEventIdHeader = req.header('Last-Event-ID');
        const sinceQuery = typeof req.query.since === 'string' ? req.query.since : undefined;
        const sinceRaw = sinceQuery || lastEventIdHeader || '0';
        const since = Number.parseInt(String(sinceRaw), 10);

        if (Number.isFinite(since) && since >= 0) {
            try {
                const pastEvents = this.agent.sessionManager.getEventsSince(sessionId, since, 2000);
                for (const evt of pastEvents) {
                    res.write(`id: ${evt.id}\n`);
                    res.write(`data: ${JSON.stringify({ id: evt.id, type: evt.type, content: evt.content })}\n\n`);
                }
            } catch (e) {
                logger.error('Failed to replay session events', e);
            }
        }

        const handler = (data: any) => {
            if (data && data.id) {
                res.write(`id: ${data.id}\n`);
            }
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sessionEvents.on(`session:${sessionId}`, handler);

        // Send initial ping
        res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);

        req.on('close', () => {
            sessionEvents.off(`session:${sessionId}`, handler);
        });
    });

    this.app.get('/api/sessions/:sessionId/events.json', (req, res) => {
      const { sessionId } = req.params;
      const sinceRaw = typeof req.query.since === 'string' ? req.query.since : '0';
      const since = Number.parseInt(String(sinceRaw || '0'), 10);
      try {
        const events = this.agent.sessionManager.getEventsSince(sessionId, Number.isFinite(since) && since >= 0 ? since : 0, 2000);
        res.json({ events });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    });

    // SSE Chat API (Deprecated for direct use, but kept for compatibility or real-time if needed)
    this.app.get('/api/chat/stream', async (req, res) => {
        let message = req.query.message as string;
        const userId = (req.query.userId as string) || 'web-user';
        const sessionId = req.query.sessionId as string;
        const webSearch = req.query.webSearch === 'true';
        const attachmentsStr = req.query.attachments as string;
        
        if (!message) {
            res.status(400).send('Message required');
            return;
        }

        // Process attachments context
        if (attachmentsStr) {
            try {
                const attachments = JSON.parse(attachmentsStr);
                if (Array.isArray(attachments) && attachments.length > 0) {
                    message += `\n\n[ATTACHMENTS]\nThe user has uploaded the following files:\n${attachments.map((f: any) => `- ${f.name} (ID: ${f.id})`).join('\n')}\nYou can refer to these files in your response.`;
                }
            } catch (e) {
                logger.error('Failed to parse attachments', e);
            }
        }

        // Process web search context
        if (webSearch) {
            message = `[WEB SEARCH REQUEST] ${message}\nPlease perform a literature review or web search to answer this question.`;
        }

        logger.info(`SSE Chat request: ${message} (Session: ${sessionId || 'auto'})`);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            const startTime = Date.now();
            let hasStreamedTokens = false;
            const reply = await this.agent.chat(userId, message, (type, content) => {
                if (type === 'token') {
                    hasStreamedTokens = true;
                    // Send token
                    res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
                } else if (type === 'thinking') {
                    // Send thinking
                    res.write(`data: ${JSON.stringify({ type: 'thinking', content })}\n\n`);
                } else if (type === 'tool_call') {
                    res.write(`data: ${JSON.stringify({ type: 'tool_call', content })}\n\n`);
                } else if (type === 'tool_result') {
                    res.write(`data: ${JSON.stringify({ type: 'tool_result', content })}\n\n`);
                } else if (type === 'log') {
                    // Send log
                    res.write(`data: ${JSON.stringify({ type: 'log', content })}\n\n`);
                } else if (type === 'plan') {
                    // Send plan
                    res.write(`data: ${JSON.stringify({ type: 'plan', content })}\n\n`);
                } else if (type === 'todo') {
                    // Send todo
                    res.write(`data: ${JSON.stringify({ type: 'todo', content })}\n\n`);
                } else if (type === 'segment') {
                    res.write(`data: ${JSON.stringify({ type: 'segment', content })}\n\n`);
                }
            }, sessionId);
            
            const duration = Date.now() - startTime;
            
            if (!hasStreamedTokens && reply) {
                 res.write(`data: ${JSON.stringify({ type: 'token', content: reply })}\n\n`);
            }
            
            // Calculate approximate token usage (simplified)
            // In a real scenario, this should come from the LLM provider response
            const estimatedTokens = Math.ceil(reply.length / 4);
            
            // Send stats
            res.write(`data: ${JSON.stringify({ 
                type: 'stats', 
                content: { 
                    duration,
                    tokens: estimatedTokens,
                    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
                } 
            })}\n\n`);
            
            // End stream
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        } catch (error) {
            logger.error('SSE error:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', content: String(error) })}\n\n`);
            res.end();
        }
    });

    // Config API
    this.app.get('/api/config', (req, res) => {
        try {
            const config = {
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                contextWindow: 1000000, // 1M tokens
                maxOutputTokens: 65536,
                provider: process.env.OPENAI_API_KEY ? 'OpenAI' : 'Mock'
            };
            res.json(config);
        } catch (error) {
            logger.error('Config error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    // Benchmark API — trigger evaluation runs and retrieve results
    this.app.get('/api/benchmark/cases', (_req, res) => {
        try {
            const { SURVEY_BENCHMARK_CASES } = require('../evals/survey-benchmark/dataset.js');
            res.json({ cases: SURVEY_BENCHMARK_CASES });
        } catch (error) {
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.post('/api/benchmark/run', async (req, res) => {
        try {
            const { runSurveyBenchmark } = await import('../evals/survey-benchmark/run.js');
            const { caseIds, depth, skipPdf } = req.body || {};
            logger.info('Starting benchmark run', { caseIds, depth });

            // Run in background, return run ID immediately
            const runId = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
            res.json({ status: 'started', runId, message: 'Benchmark run started. Check /api/benchmark/results for progress.' });

            // Fire and forget — results are written to disk
            runSurveyBenchmark({
                caseIds: Array.isArray(caseIds) ? caseIds : undefined,
                depth: depth || undefined,
                skipPdf: skipPdf !== false
            }).then((summary: any) => {
                logger.success(`Benchmark run ${runId} complete`, { averageScore: summary.averageScore });
            }).catch((error: any) => {
                logger.error(`Benchmark run ${runId} failed`, error);
            });
        } catch (error) {
            res.status(500).json({ error: String(error) });
        }
    });

    this.app.get('/api/benchmark/results', (_req, res) => {
        try {
            const resultsDir = path.join(process.cwd(), 'workspace', 'evals', 'survey-small-benchmark');
            if (!fs.existsSync(resultsDir)) {
                res.json({ runs: [] });
                return;
            }
            const runs = fs.readdirSync(resultsDir)
                .filter((name) => fs.statSync(path.join(resultsDir, name)).isDirectory())
                .sort()
                .reverse()
                .slice(0, 20)
                .map((name) => {
                    const summaryPath = path.join(resultsDir, name, 'summary.json');
                    if (fs.existsSync(summaryPath)) {
                        try {
                            return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
                        } catch { return { runId: name, error: 'Failed to parse summary' }; }
                    }
                    return { runId: name, status: 'in_progress' };
                });
            res.json({ runs });
        } catch (error) {
            res.status(500).json({ error: String(error) });
        }
    });

  }

  public async start(): Promise<Server> {
    if (this.server) return this.server;

    return await new Promise<Server>((resolve, reject) => {
      const server = this.app.listen(this.port, () => {
        this.server = server;

        const address = server.address();
        if (address && typeof address === 'object') {
          this.port = (address as AddressInfo).port;
          if (this.agentCard) {
            this.agentCard.url = `http://localhost:${this.port}/a2a/jsonrpc`;
            this.agentCard.additionalInterfaces = [
              { url: `http://localhost:${this.port}/a2a/jsonrpc`, transport: 'JSONRPC' },
              { url: `http://localhost:${this.port}/a2a/rest`, transport: 'HTTP+JSON' },
            ];
          }
        }

        logger.success(`A2A Gateway started on http://localhost:${this.port}`);
        logger.info(`- Agent Card: http://localhost:${this.port}/${AGENT_CARD_PATH}`);
        logger.info(`- JSON-RPC: http://localhost:${this.port}/a2a/jsonrpc`);
        resolve(server);
      });

      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  public getPort(): number {
    return this.port;
  }

  public async stop(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
