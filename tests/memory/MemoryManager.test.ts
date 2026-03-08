import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';
import fs from 'fs';
import path from 'path';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(process.cwd(), 'data', 'test.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    const llm = new MockLLMClient();
    memoryManager = new MemoryManager(storage, llm);
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should add a memory', async () => {
    const memory = await memoryManager.addMemory('user1', 'preference', 'likes dark mode');
    expect(memory).toBeDefined();
    expect(memory.content).toBe('likes dark mode');
    expect(memory.user_id).toBe('user1');
  });

  it('should retrieve memories for a user', async () => {
    await memoryManager.addMemory('user1', 'preference', 'likes dark mode');
    await memoryManager.addMemory('user1', 'fact', 'lives in NYC');

    const memories = await memoryManager.getUserMemories('user1');
    expect(memories.length).toBe(2);
  });

  it('should filter memories by type', async () => {
    await memoryManager.addMemory('user1', 'preference', 'likes dark mode');
    await memoryManager.addMemory('user1', 'fact', 'lives in NYC');

    const preferences = await memoryManager.getUserMemories('user1', 'preference');
    expect(preferences.length).toBe(1);
    expect(preferences[0].content).toBe('likes dark mode');
  });

  it('should update memory weight', async () => {
    const memory = await memoryManager.addMemory('user1', 'preference', 'likes dark mode');
    await memoryManager.updateMemoryWeight(memory.id, 0.5);

    const updated = await memoryManager.getMemory(memory.id);
    expect(updated.weight).toBe(1.5);
  });

  it('should search memories by keyword', async () => {
    await memoryManager.addMemory('user1', 'preference', 'likes dark mode');
    await memoryManager.addMemory('user1', 'fact', 'lives in NYC');
    await memoryManager.addMemory('user1', 'context', 'working on frontend');

    const results = await memoryManager.searchMemories('user1', 'mode', { useVector: false });
    expect(results.length).toBe(1);
    expect(results[0].content).toBe('likes dark mode');

    const empty = await memoryManager.searchMemories('user1', 'banana', { useVector: false });
    expect(empty.length).toBe(0);
  });

  it('should format memories for injection', async () => {
    await memoryManager.addMemory('user1', 'preference', 'likes dark mode');
    
    const formatted = await memoryManager.getFormattedMemories('user1', 'dark');
    expect(formatted).toContain('[PREFERENCE] likes dark mode');
    expect(formatted).toContain('weight: 1');
  });

  it('should fallback to recent memories if search fails', async () => {
    await memoryManager.addMemory('user1', 'fact', 'important fact');
    
    const formatted = await memoryManager.getFormattedMemories('user1', 'nonexistent');
    expect(formatted).toContain('[FACT] important fact');
  });
});
