import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent } from '../../src/agent/ResearchAgent.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../src/memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient, LLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

vi.mock('../../src/skills/lib/ScholarTool.js', () => {
  return {
    ScholarTool: class {
      async searchPapers(topic: string) {
        return [
          { title: 'Reasoning Paper 1', year: 2024, summary: 'Summary 1', url: 'https://example.com/1', authors: ['A'] },
          { title: 'Reasoning Paper 2', year: 2023, summary: 'Summary 2', url: 'https://example.com/2', authors: ['B'] }
        ];
      }
    }
  };
});

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
    const chatSpy = vi.spyOn(llm, 'chat')
        // 1. Planner Response (returns empty to force fallback to legacy logic for this test)
        .mockResolvedValueOnce({
            content: JSON.stringify({ intent: 'single', steps: [] })
        })
        // 2. Survey summary response (used by academic_survey_self_improve)
        .mockResolvedValueOnce({
            content: 'This is a literature review summary.'
        })
        // 3. Quality Check Response
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
    expect(chatSpy).toHaveBeenCalled();
    
    // Verify papers were added
    const papers = await memoryManager.getUserMemories('user1', 'paper');
    expect(papers.length).toBeGreaterThan(0);
  });
});
