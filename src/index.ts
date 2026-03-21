import { A2AGateway } from './gateway/index.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { SQLiteStorage } from './storage/sqlite.js';
import { ResearchAgent } from './agent/ResearchAgent.js';
import { MemoryEvolutionSystem } from './memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient, LLMClient, LLMResponse, LLMStreamHandler } from './llm/LLMClient.js';
import { OpenAIClient } from './llm/OpenAIClient.js';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger.js';

dotenv.config({ override: true });

const logger = createLogger('Main');

import { fileURLToPath } from 'url';

import { SkillManager } from './skills/SkillManager.js';
import path from 'path';
import fs from 'fs';

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

  const workspaceRoot = path.join(process.cwd(), 'workspace');
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const skillManager = new SkillManager(llm, memoryManager, workspaceRoot, undefined, systemSkillsDir);
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
