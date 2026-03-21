import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent } from '../../src/agent/ResearchAgent.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../src/memory/evolution/MemoryEvolutionSystem.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';
import fs from 'fs';
import path from 'path';

describe('ResearchAgent - Planning', () => {
  let agent: ResearchAgent;
  let memoryManager: MemoryManager;
  let memoryEvo: MemoryEvolutionSystem;
  let llm: MockLLMClient;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = path.join(process.cwd(), 'data', 'test-agent-planning.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    llm = new MockLLMClient();
    memoryManager = new MemoryManager(storage, llm);
    memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
    
    agent = new ResearchAgent(memoryManager, memoryEvo, llm);
    
    // Wait for skills to load
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterEach(() => {
    if (memoryManager && memoryManager.storage) {
        memoryManager.storage.close();
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should handle research requests through chat interface', async () => {
    // Mock the skill manager's executeSkill directly to track calls
    const executeSkillSpy = vi.spyOn(agent.skillManager, 'executeSkill').mockResolvedValue({
      success: true,
      result: 'Found papers',
      papers: []
    } as any);

    // Mock LLM to return tool calls immediately
    vi.spyOn(llm, 'chat').mockResolvedValue({
      content: '',
      tool_calls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'paper_search',
          arguments: JSON.stringify({ query: 'LLM reasoning', max_results: 3 })
        }
      }]
    });

    const reply = await agent.chat('user1', 'Search for LLM reasoning papers');

    expect(reply).toBeDefined();
    expect(llm.chat).toHaveBeenCalled();
    expect(executeSkillSpy).toHaveBeenCalled();
  });

  it('should handle multi-step requests through chat interface', async () => {
    // Mock the skill manager's executeSkill directly to track calls
    const executeSkillSpy = vi.spyOn(agent.skillManager, 'executeSkill').mockResolvedValue({
      success: true,
      result: 'Research completed'
    } as any);

    // Mock LLM to return tool calls immediately
    vi.spyOn(llm, 'chat').mockResolvedValue({
      content: '',
      tool_calls: [{
        id: 'call_1',
        type: 'function',
        function: {
          name: 'literature_review',
          arguments: JSON.stringify({ topic: 'LLMs', max_papers: 2 })
        }
      }]
    });

    const reply = await agent.chat('user1', 'Do a multi-step research on LLMs');

    expect(reply).toBeDefined();
    expect(llm.chat).toHaveBeenCalled();
    expect(executeSkillSpy).toHaveBeenCalled();
  });
});
