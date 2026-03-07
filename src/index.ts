import { startGateway } from './infra/gateway/index.js';
import { A2AGateway } from './infra/a2a/gateway.js';
import { SQLiteStorage } from './infra/storage/sqlite.js';
import { MemoryManager } from './core/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from './app/memory-evo/MemoryEvolutionSystem.js';
import { ResearchAgent } from './core/agent/ResearchAgent.js';
import { MockLLMClient, LLMClient, LLMResponse, LLMStreamHandler } from './core/llm/LLMClient.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ override: true });

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
  console.log(chalk.green.bold('🦎 Redigg Agent System Starting...'));

  // 1. Initialize Core Components
  const storage = new SQLiteStorage();
  const memoryManager = new MemoryManager(storage);

  let llm: LLMClient;
  if (process.env.OPENAI_API_KEY) {
    console.log(chalk.blue('Using Real OpenAI API'));
    llm = new OpenAIClient(
      process.env.OPENAI_API_KEY!,
      process.env.OPENAI_BASE_URL,
      process.env.OPENAI_MODEL
    );
  } else {
    console.log(chalk.yellow('Using Mock LLM'));
    llm = new MockLLMClient();
  }

  const memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
  const agent = new ResearchAgent(memoryManager, memoryEvo, llm);

  // 2. Start A2A Gateway
  const a2aPort = parseInt(process.env.A2A_PORT || '4000');
  const a2aGateway = new A2AGateway(agent, a2aPort);
  a2aGateway.start();

  // 3. Start Legacy Gateway (if needed)
  // await startGateway();
}

main().catch(error => {
  console.error('Failed to start Redigg:', error);
  process.exit(1);
});
