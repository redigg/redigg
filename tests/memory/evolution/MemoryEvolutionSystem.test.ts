import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryEvolutionSystem, ExtractedMemory } from '../../../src/memory/evolution/MemoryEvolutionSystem.js';
import { MemoryManager } from '../../../src/memory/MemoryManager.js';
import { MockLLMClient, LLMClient } from '../../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

describe('MemoryEvolutionSystem', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;
  let llm: LLMClient;
  let evolutionSystem: MemoryEvolutionSystem;

  beforeEach(() => {
    dbPath = path.join(process.cwd(), 'data', 'test-evo.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    memoryManager = new MemoryManager(storage);
    llm = new MockLLMClient();
    evolutionSystem = new MemoryEvolutionSystem(memoryManager, llm);
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should extract memories from interaction', async () => {
    // Mock the LLM to return specific memories
    const mockMemories: ExtractedMemory[] = [
      { type: 'preference', content: 'Prefers concise answers' },
      { type: 'fact', content: 'Studying immunology' }
    ];

    vi.spyOn(llm, 'chat').mockResolvedValue({
      content: JSON.stringify({ memories: mockMemories })
    });

    await evolutionSystem.evolve('user1', 'What is THBS2?', 'THBS2 is a protein...');

    const memories = await memoryManager.getUserMemories('user1');
    expect(memories.length).toBe(2);
    expect(memories.find(m => m.type === 'preference')?.content).toBe('Prefers concise answers');
    expect(memories.find(m => m.type === 'fact')?.content).toBe('Studying immunology');
  });

  it('should handle invalid JSON from LLM gracefully', async () => {
    vi.spyOn(llm, 'chat').mockResolvedValue({
      content: 'This is not JSON'
    });

    await evolutionSystem.evolve('user1', 'Hello', 'Hi');

    const memories = await memoryManager.getUserMemories('user1');
    expect(memories.length).toBe(0);
  });
});
