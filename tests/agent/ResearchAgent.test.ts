import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent } from '../../src/agent/ResearchAgent.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../src/memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient, LLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

describe('ResearchAgent', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;
  let llm: LLMClient;
  let memoryEvo: MemoryEvolutionSystem;
  let agent: ResearchAgent;

  beforeEach(() => {
    dbPath = path.join(process.cwd(), 'data', 'test-agent.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    memoryManager = new MemoryManager(storage);
    llm = new MockLLMClient();
    memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
    agent = new ResearchAgent(memoryManager, memoryEvo, llm);
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should generate response and trigger memory evolution', async () => {
    // 1. Setup Memory
    await memoryManager.addMemory('user1', 'preference', 'Prefers concise answers');

    // 2. Mock LLM Response
    const chatSpy = vi.spyOn(llm, 'chat')
      // 1. Planner Response (new logic)
      .mockResolvedValueOnce({
        content: JSON.stringify({ intent: 'single', steps: [] }) // Empty plan -> fallback to legacy logic
      })
      // 2. shouldSearch check (legacy logic)
      .mockResolvedValueOnce({
        content: 'NO_SEARCH' 
      })
      // 3. Actual Chat Response (legacy logic)
      .mockResolvedValueOnce({
        content: 'THBS2 is Thrombospondin-2.'
      })
      // 4. Memory Evolution (post-processing)
      .mockResolvedValueOnce({
        content: JSON.stringify({ memories: [{ type: 'fact', content: 'User asked about THBS2' }] })
      });

    // 3. Chat
    // Use the agent instance created in beforeEach to ensure correct setup
    // But we need to recreate it if we want to spy on the LLM passed to it?
    // Actually `llm` is passed by reference, so spying on it works.
    // However, the test creates a NEW agent instance inside `it` block:
    const testAgent = new ResearchAgent(memoryManager, memoryEvo, llm);
    
    // We need to wait for skills to load if any, but here we don't use skills explicitly in the fallback path.
    
    const reply = await testAgent.chat('user1', 'What is THBS2?');

    // 4. Verify Response
    expect(reply).toBe('THBS2 is Thrombospondin-2.');

    // 5. Verify Context Injection
    // The spy is called 4 times: planner, shouldSearch, chat, evolution
    // We check the third call which is the chat
    const chatCall = chatSpy.mock.calls[2];
    const systemPrompt = (chatCall[0] as any[]).find((m: any) => m.role === 'system')?.content;
    expect(systemPrompt).toContain('Prefers concise answers');

    // 6. Verify Memory Evolution (wait a bit for async)
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check that evolution was triggered
    expect(chatSpy).toHaveBeenCalledTimes(4);
    
    const memories = await memoryManager.getUserMemories('user1');
    expect(memories.length).toBe(2); // 1 preference + 1 new fact
    expect(memories.find(m => m.type === 'fact')?.content).toBe('User asked about THBS2');
  });
});
