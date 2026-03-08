import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryEvolutionSystem, ExtractedMemory } from '../../../src/memory/evolution/MemoryEvolutionSystem.js';
import { MemoryManager } from '../../../src/memory/MemoryManager.js';
import { MockLLMClient, LLMClient } from '../../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

describe('MemoryEvolutionSystem - Paper Extraction', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;
  let llm: LLMClient;
  let evolutionSystem: MemoryEvolutionSystem;

  beforeEach(() => {
    dbPath = path.join(process.cwd(), 'data', 'test-evo-paper.db');
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

  it('should extract research paper with metadata', async () => {
    // Mock the LLM to return a paper memory
    const mockMemories: ExtractedMemory[] = [
      { 
        type: 'paper', 
        content: 'Paper: Attention Is All You Need',
        metadata: {
          title: 'Attention Is All You Need',
          authors: ['Vaswani et al.'],
          url: 'https://arxiv.org/abs/1706.03762'
        }
      }
    ];

    vi.spyOn(llm, 'chat').mockResolvedValue({
      content: JSON.stringify({ memories: mockMemories })
    });

    await evolutionSystem.evolve(
      'user1', 
      'Have you read Attention Is All You Need?', 
      'Yes, it introduced the Transformer architecture.'
    );

    const memories = await memoryManager.getUserMemories('user1', 'paper');
    expect(memories.length).toBe(1);
    
    const paper = memories[0];
    expect(paper.type).toBe('paper');
    expect(paper.content).toContain('Attention Is All You Need');
    expect(paper.metadata).toBeDefined();
    expect(paper.metadata.title).toBe('Attention Is All You Need');
    expect(paper.metadata.url).toBe('https://arxiv.org/abs/1706.03762');
  });
});
