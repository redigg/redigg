import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent } from '../../src/agent/ResearchAgent.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../src/memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient, LLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import { SkillManager } from '../../src/skills/SkillManager.js';
// LiteratureReviewSkill is now a default export from the skill file, not a named export
import LiteratureReviewSkill from '../../skills/research/literature-review/index.js';
import fs from 'fs';
import path from 'path';

describe('ResearchAgent - Skills', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;
  let llm: MockLLMClient;
  let memoryEvo: MemoryEvolutionSystem;
  let agent: ResearchAgent;

  beforeEach(async () => {
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
    
    // Wait for skills to load from disk
    await new Promise(resolve => setTimeout(resolve, 1000));
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

    // Mock chat response
    const chatSpy = vi.spyOn(llm, 'chat')
        // 1. Planner Response (returns empty to force fallback to legacy logic for this test)
        .mockResolvedValueOnce({
            content: JSON.stringify({ intent: 'single', steps: [] })
        })
        // 2. Quality Check Response
        .mockResolvedValueOnce({
            content: JSON.stringify({
                score: 85,
                reasoning: 'Good review.',
                suggestions: [],
                passed: true
            })
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
