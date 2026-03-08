import { A2AGateway } from './gateway/index.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { SQLiteStorage } from './storage/sqlite.js';
import { ResearchAgent } from './agent/ResearchAgent.js';
import { MemoryEvolutionSystem } from './memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient, LLMClient } from './llm/LLMClient.js';
import { OpenAIClient } from './llm/OpenAIClient.js';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger.js';

dotenv.config({ override: true });

const logger = createLogger('Main');

async function main() {
  logger.info('🦎 Redigg Agent System Starting...');

  // 1. Initialize LLM first as MemoryManager needs it
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

  // 2. Initialize Core Components
  const storage = new SQLiteStorage();
  const memoryManager = new MemoryManager(storage, llm);


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
