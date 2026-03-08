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

const logger = createLogger('Gateway');

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + '-' + file.originalname)
    }
})

const upload = multer({ storage: storage });

export class A2AGateway {
  private app: express.Express;
  private port: number;
  private agent: ResearchAgent;

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

    const executor: AgentExecutor = {
      execute: async (requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> => {
        const task = requestContext.task;
        if (!task) {
          logger.error('No task found in context');
          eventBus.finished();
          return;
        }

        const input = (task as any).input;
        const userId = 'a2a-user'; // TODO: Extract from auth context if available

        logger.info(`Received request: ${JSON.stringify(input)}`);

        try {
          // Extract text from input (assuming simple text message for now)
          let userMessage = '';
          if (typeof input === 'string') {
            userMessage = input;
          } else if (input && typeof input === 'object' && 'text' in input) {
            userMessage = (input as any).text;
          } else if (input && typeof input === 'object' && 'message' in input) {
             // Handle standard A2A message format
             const msg = input as any;
             if (msg.message && msg.message.parts && msg.message.parts.length > 0) {
                userMessage = msg.message.parts[0].text;
             }
          }

          if (!userMessage) {
            userMessage = "Hello";
          }

          const reply = await this.agent.chat(userId, userMessage);

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
          logger.error('Error executing task:', error);
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
    this.app.use(express.json());
    
    // File Upload API
    this.app.post('/api/upload', upload.single('file'), (req, res) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }
            logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);
            res.json({
                id: req.file.filename,
                name: req.file.originalname,
                path: req.file.path,
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
        const reply = await this.agent.chat(userId, message);
        res.json({ reply });
      } catch (error) {
        logger.error('Chat error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Skill API
    this.app.get('/api/skills', (req, res) => {
        try {
            const skills = this.agent.skillManager.getAllSkills().map(s => {
                // Find which pack this skill belongs to
                const pack = this.agent.skillManager.getAllPacks().find(p => p.skills.some(sk => sk.id === s.id));
                return {
                    id: s.id,
                    name: (s as any).name || s.id, 
                    description: (s as any).description || '',
                    packId: pack?.id
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

    this.app.delete('/api/sessions/:sessionId', (req, res) => {
        const { sessionId } = req.params;
        try {
            this.agent.sessionManager.deleteSession(sessionId);
            res.json({ success: true });
        } catch (error) {
            logger.error('Delete session error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    // SSE Chat API
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
                } else if (type === 'log') {
                    // Send log
                    res.write(`data: ${JSON.stringify({ type: 'log', content })}\n\n`);
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

  }

  public start() {
    this.app.listen(this.port, () => {
      logger.success(`A2A Gateway started on http://localhost:${this.port}`);
      logger.info(`- Agent Card: http://localhost:${this.port}/${AGENT_CARD_PATH}`);
      logger.info(`- JSON-RPC: http://localhost:${this.port}/a2a/jsonrpc`);
    });
  }
}
