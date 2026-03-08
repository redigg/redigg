import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillManager } from '../../src/skills/SkillManager.js';
import LiteratureReviewSkill from '../../skills/research/literature-review/index.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

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
    skillManager.registerSkill(new LiteratureReviewSkill());
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should execute literature review skill', async () => {
    // Mock LLM Response for summary
    vi.spyOn(llm, 'complete').mockResolvedValue({
      content: 'This is a summary of the literature review.'
    });

    const result = await skillManager.executeSkill('literature_review', 'user1', { topic: 'reasoning in LLMs' });
    
    expect(result).toBeDefined();
    expect(result.summary).toBe('This is a summary of the literature review.');
    expect(result.papers).toBeDefined();
    expect(result.papers.length).toBeGreaterThan(0);
    
    // Check if papers were added to memory
    const papers = await memoryManager.getUserMemories('user1', 'paper');
    expect(papers.length).toBeGreaterThan(0);
    expect(papers[0].content).toContain('Paper:');
  });

  it('should handle missing topic', async () => {
    await expect(skillManager.executeSkill('literature_review', 'user1', {}))
      .rejects.toThrow('Topic is required');
  });
});
