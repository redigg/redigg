import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillManager } from '../../src/skills/SkillManager.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

class MockSkill {
  id = 'mock_skill';
  name = 'Mock Skill';
  description = 'A mock skill';
  tags = ['mock'];
  parameters = { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] };
  async execute(ctx: any, params: any) {
    if (!params.topic) throw new Error('Topic is required');
    return { summary: 'Mock summary', papers: ['Paper 1'] };
  }
}

describe('SkillManager', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;
  let llm: MockLLMClient;
  let skillManager: SkillManager;

  beforeEach(() => {
    dbPath = path.join(process.cwd(), 'data', 'test-skill.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    memoryManager = new MemoryManager(storage);
    llm = new MockLLMClient();
    skillManager = new SkillManager(llm, memoryManager);

    // Register skill
    skillManager.registerSkill(new MockSkill());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should execute mock skill', async () => {
    const result = await skillManager.executeSkill('mock_skill', 'user1', { topic: 'reasoning in LLMs' });
    
    expect(result).toBeDefined();
    expect(result.summary).toBe('Mock summary');
    expect(result.papers).toBeDefined();
    expect(result.papers.length).toBeGreaterThan(0);
  });

  it('should handle missing topic', async () => {
    await expect(skillManager.executeSkill('mock_skill', 'user1', {}))
      .rejects.toThrow('Topic is required');
  });
});
