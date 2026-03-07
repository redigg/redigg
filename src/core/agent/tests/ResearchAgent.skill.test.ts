import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent } from '../ResearchAgent.js';
import { MemoryManager } from '../../memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../../app/memory-evo/MemoryEvolutionSystem.js';
import { MockLLMClient, LLMClient } from '../../llm/LLMClient.js';
import { SQLiteStorage } from '../../../infra/storage/sqlite.js';
import { SkillManager } from '../../skills/SkillManager.js';
import { LiteratureReviewSkill } from '../../skills/impl/LiteratureReviewSkill.js';
import fs from 'fs';
import path from 'path';

describe('ResearchAgent - Skills', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;
  let llm: MockLLMClient;
  let memoryEvo: MemoryEvolutionSystem;
  let agent: ResearchAgent;

  beforeEach(() => {
    dbPath = path.join(process.cwd(), 'data', 'test-agent-skill.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    memoryManager = new MemoryManager(storage);
    llm = new MockLLMClient();
    memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
    
    // We pass undefined for skillManager, ResearchAgent should create its own and register skills
    agent = new ResearchAgent(memoryManager, memoryEvo, llm);
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should detect intent and execute literature review skill', async () => {
    // Mock LLM Response for summary (used by skill)
    vi.spyOn(llm, 'complete').mockResolvedValue({
      content: 'This is a literature review summary.'
    });

    // Mock chat response for fallback (should not be called if skill runs)
    const chatSpy = vi.spyOn(llm, 'chat').mockResolvedValue({
      content: 'I can help with that.'
    });

    const reply = await agent.chat('user1', 'Do a literature review on reasoning in LLMs');
    
    // Check if reply contains skill output
    expect(reply).toContain('Here is a literature review on "reasoning in LLMs"');
    expect(reply).toContain('This is a literature review summary.');
    
    // Verify papers were added
    const papers = await memoryManager.getUserMemories('user1', 'paper');
    expect(papers.length).toBeGreaterThan(0);
  });
});
