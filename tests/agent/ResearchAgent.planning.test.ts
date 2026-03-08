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

  it('should create and execute a single-step plan', async () => {
    // Mock LLM response for planning
    const planJson = JSON.stringify({
      intent: 'single',
      steps: [
        {
          id: '1',
          description: 'Search for papers on LLM',
          tool: 'LiteratureReview',
          params: { topic: 'LLM Reasoning' }
        }
      ]
    });

    // Mock chat to return plan first, then maybe something else
    // We need to spy on llm.chat
    const chatSpy = vi.spyOn(llm, 'chat');
    chatSpy.mockResolvedValueOnce({ content: planJson });

    // Mock skill execution
    // Since executeLiteratureReview calls executeSkill, we can rely on MockLLMClient returning something for the skill too?
    // Actually executeLiteratureReview calls `executeSkill`, which calls `literature_review` skill.
    // The skill calls `llm.chat` or `llm.complete`.
    
    // Let's just track the plan events
    const onProgress = vi.fn();
    
    // Mock fetch for ScholarTool
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `
          <feed>
            <entry>
              <title>LLM Reasoning Paper</title>
              <summary>A paper about LLM reasoning.</summary>
              <author><name>Author A</name></author>
              <published>2023-01-01T00:00:00Z</published>
              <link title="pdf" href="http://arxiv.org/pdf/1234.5678" />
            </entry>
          </feed>
        `
    } as any);
    
    await agent.chat('user1', 'Search for papers on LLM Reasoning', onProgress);

    // Verify plan events were emitted
    const planCalls = onProgress.mock.calls.filter(c => c[0] === 'plan');
    expect(planCalls.length).toBeGreaterThan(0);
    
    // Check initial plan
    expect(planCalls[0][1].steps[0].description).toBe('Search for papers on LLM');
    
    // Check completion
    const lastPlan = planCalls[planCalls.length - 1][1];
    expect(lastPlan.steps[0].status).toBe('completed');
  });

  it('should create and execute a multi-step plan', async () => {
    const planJson = JSON.stringify({
      intent: 'multi_step',
      steps: [
        {
          id: '1',
          description: 'Search memories',
          tool: 'MemorySearch',
          params: { query: 'Project X' }
        },
        {
          id: '2',
          description: 'Chat response',
          tool: 'Chat',
          params: { message: 'Summarize findings' }
        }
      ]
    });

    const chatSpy = vi.spyOn(llm, 'chat');
    chatSpy.mockResolvedValueOnce({ content: planJson }); // For Planner
    chatSpy.mockResolvedValueOnce({ content: 'Here is the summary...' }); // For Chat step

    const onProgress = vi.fn();
    
    await agent.chat('user1', 'Find info on Project X and summarize', onProgress);

    const planCalls = onProgress.mock.calls.filter(c => c[0] === 'plan');
    expect(planCalls.length).toBeGreaterThan(0);
    expect(planCalls[0][1].steps.length).toBe(2);
    
    const lastPlan = planCalls[planCalls.length - 1][1];
    expect(lastPlan.steps[0].status).toBe('completed');
    expect(lastPlan.steps[1].status).toBe('completed');
  });
});
