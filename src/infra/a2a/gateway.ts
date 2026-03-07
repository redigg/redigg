import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AgentCard, Message, AGENT_CARD_PATH } from '@a2a-js/sdk';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  InMemoryTaskStore,
} from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { ResearchAgent } from '../../core/agent/ResearchAgent.js';
import chalk from 'chalk';

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
          console.error('[A2A] No task found in context');
          eventBus.finished();
          return;
        }

        const input = (task as any).input;
        const userId = 'a2a-user'; // TODO: Extract from auth context if available

        console.log(chalk.blue(`[A2A] Received request: ${JSON.stringify(input)}`));

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
          console.error('[A2A] Error executing task:', error);
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
    this.app.post('/api/chat', async (req, res) => {
      const { message, userId = 'web-user' } = req.body;
      console.log(chalk.blue(`[WebAPI] Chat request: ${message}`));
      try {
        const reply = await this.agent.chat(userId, message);
        res.json({ reply });
      } catch (error) {
        console.error('[WebAPI] Chat error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // SSE Chat API
    this.app.get('/api/chat/stream', async (req, res) => {
        const message = req.query.message as string;
        const userId = (req.query.userId as string) || 'web-user';
        
        if (!message) {
            res.status(400).send('Message required');
            return;
        }

        console.log(chalk.blue(`[WebAPI] SSE Chat request: ${message}`));

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            await this.agent.chat(userId, message, (type, content) => {
                if (type === 'token') {
                    // Send token
                    res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
                } else if (type === 'log') {
                    // Send log
                    res.write(`data: ${JSON.stringify({ type: 'log', content })}\n\n`);
                }
            });
            
            // End stream
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        } catch (error) {
            console.error('[WebAPI] SSE error:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', content: String(error) })}\n\n`);
            res.end();
        }
    });

  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(chalk.green(`🚀 A2A Gateway started on http://localhost:${this.port}`));
      console.log(chalk.gray(`- Agent Card: http://localhost:${this.port}/${AGENT_CARD_PATH}`));
      console.log(chalk.gray(`- JSON-RPC: http://localhost:${this.port}/a2a/jsonrpc`));
    });
  }
}
