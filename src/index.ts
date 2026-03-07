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
    return { content: response.choices[0].message.content || '' };
  }

  async chat(messages: { role: string; content: string }[]): Promise<LLMResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: messages as any,
    });
    return { content: response.choices[0].message.content || '' };
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
          fullText += content;
          handler.onToken?.(content);
        }
      }
      handler.onComplete?.(fullText);
    } catch (error) {
      handler.onError?.(error);
      throw error;
    }
  }
}

async function main() {
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

  const memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
  const agent = new ResearchAgent(memoryManager, memoryEvo, llm);
  
  // Start agent background processes (heartbeat, cron)
  agent.start();

  // Start A2A Gateway
  const gateway = new A2AGateway(agent, 4000);
  gateway.start();
}

main().catch(error => {
  logger.error('Failed to start Redigg:', error);
  process.exit(1);
});
