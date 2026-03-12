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
    
    // Mock fetch for ScholarTool
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('arxiv.org')) {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2101.00001v1</id>
    <title>Test Paper</title>
    <summary>Test Summary</summary>
    <author><name>Test Author</name></author>
    <published>2021-01-01T00:00:00Z</published>
  </entry>
</feed>`, { status: 200, headers: { 'Content-Type': 'application/xml' } });
      }
      if (url.includes('openalex.org')) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes('semanticscholar.org')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    // Register skill
    skillManager.registerSkill(new LiteratureReviewSkill());
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
