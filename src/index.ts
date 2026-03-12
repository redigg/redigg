import { A2AGateway } from './gateway/index.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { SQLiteStorage } from './storage/sqlite.js';
import { ResearchAgent } from './agent/ResearchAgent.js';
import { MemoryEvolutionSystem } from './memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient, LLMClient, LLMResponse, LLMStreamHandler } from './llm/LLMClient.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger.js';

dotenv.config({ override: true });

const logger = createLogger('Main');

// Real OpenAI Client (Copied from cli.ts for now, should be refactored to shared location)
class OpenAIClient implements LLMClient {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.openai = new OpenAI({ 
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1'
    });
    this.model = model || 'gpt-3.5-turbo';
  }

  async complete(prompt: string): Promise<LLMResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.choices[0].message.content || '';
    console.log('[LLM Complete Output]:', content);
    return { content };
  }

  async chat(messages: { role: string; content: string }[]): Promise<LLMResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: messages as any,
    });
    const content = response.choices[0].message.content || '';
    console.log('[LLM Chat Output]:', content);
    return { content };
  }

  async chatStream(messages: { role: string; content: string }[], handler: LLMStreamHandler): Promise<void> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages as any,
        stream: true,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          process.stdout.write(content); // Stream to console for debugging
          fullText += content;
          handler.onToken?.(content);
        }
      }
      process.stdout.write('\n'); // End of stream newline
      handler.onComplete?.(fullText);
    } catch (error) {
      handler.onError?.(error);
      throw error;
    }
  }
}

import { fileURLToPath } from 'url';

import { SkillManager } from './skills/SkillManager.js';
import path from 'path';

// ...

export async function main(options: { port?: number } = {}) {
  logger.info('🦎 Redigg Agent System Starting...');

  // 1. Initialize Core Components
  const storage = new SQLiteStorage();
  const memoryManager = new MemoryManager(storage);

  let llm: LLMClient;
  if (process.env.OPENAI_API_KEY) {
    logger.info('Using Real OpenAI API');
    llm = new OpenAIClient(
      process.env.OPENAI_API_KEY!,
      process.env.OPENAI_BASE_URL,
      process.env.OPENAI_MODEL
    );
  } else {
    logger.warn('Using Mock LLM');
    llm = new MockLLMClient();
  }

  // Calculate system skills path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const systemSkillsDir = path.join(__dirname, '..', 'skills');

  const skillManager = new SkillManager(llm, memoryManager, process.cwd(), undefined, systemSkillsDir);
  await skillManager.loadSkillsFromDisk();

  const memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
  const agent = new ResearchAgent(memoryManager, memoryEvo, llm, skillManager);
  
  // Start agent background processes (heartbeat, cron)
  agent.start();

  // Start A2A Gateway
  const port = options.port || parseInt(process.env.PORT || '4000');
  const gateway = new A2AGateway(agent, port);
  gateway.start();
}

// Only run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    logger.error('Failed to start Redigg:', error);
    process.exit(1);
  });
}
