import { describe, it, expect, beforeAll } from 'vitest';
import { ResearchAgent } from '../../src/agent/ResearchAgent.js';
import { LLMClient } from '../../src/llm/LLMClient.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../src/memory/evolution/MemoryEvolutionSystem.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import path from 'path';

describe('Core Skills Integration', () => {
  let agent: ResearchAgent;
  let llm: LLMClient;
  let memory: MemoryManager;

  beforeAll(async () => {
    // Mock LLM or use real one? 
    // For unit tests, we should mock. For integration, maybe real but expensive.
    // Let's use a mock LLMClient for now to test the piping.
    
    // We need to implement a MockLLMClient or just cast a mock object
    const mockLLM = {
        chat: async (msgs: any) => ({ content: 'Mock response' }),
        complete: async (prompt: string) => ({ content: 'Mock completion' }),
        embed: async (text: string) => Array(1536).fill(0),
    } as unknown as LLMClient;
    
    llm = mockLLM;
    memory = new MemoryManager(new SQLiteStorage(':memory:'), llm);
    
    const memoryEvo = new MemoryEvolutionSystem(memory, llm);
    
    agent = new ResearchAgent(memory, memoryEvo, llm);
    
    // Wait for async loading
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should load all core skills', () => {
    const skills = agent.skillManager.getAllSkills();
    const skillIds = skills.map(s => s.id);
    
    expect(skillIds).toContain('agent_orchestration');
    expect(skillIds).toContain('evolution');
    expect(skillIds).toContain('memory_management');
    expect(skillIds).toContain('scheduling');
    expect(skillIds).toContain('session_management');
    expect(skillIds).toContain('skill_management');
    
    // Infra
    expect(skillIds).toContain('local_file_ops');
    expect(skillIds).toContain('code_analysis');
    
    // Research
    expect(skillIds).toContain('literature_review');
  });

  it('should load skill packs', () => {
    const packs = agent.skillManager.getAllPacks();
    const packIds = packs.map(p => p.id);
    
    expect(packIds).toContain('core');
    expect(packIds).toContain('infra');
    expect(packIds).toContain('research');
  });

  it('should be able to execute session_management skill', async () => {
    const result = await agent.skillManager.executeSkill('session_management', 'test-user', {
        operation: 'list_sessions'
    });
    
    expect(result).toBeDefined();
    expect(result.sessions).toBeInstanceOf(Array);
  });

  it('should be able to execute scheduling skill', async () => {
    // Schedule a task
    const scheduleResult = await agent.skillManager.executeSkill('scheduling', 'test-user', {
        operation: 'schedule_task',
        name: 'Test Task',
        cron: '* * * * *',
        skill: 'session_management',
        params: {}
    });
    
    expect(scheduleResult.success).toBe(true);
    expect(scheduleResult.taskId).toBeDefined();

    // List tasks
    const listResult = await agent.skillManager.executeSkill('scheduling', 'test-user', {
        operation: 'list_tasks'
    });
    
    expect(listResult.tasks).toHaveLength(1);
    expect(listResult.tasks[0].name).toBe('Test Task');
    
    // Cleanup
    await agent.skillManager.executeSkill('scheduling', 'test-user', {
        operation: 'remove_task',
        taskId: scheduleResult.taskId
    });
  });

  it('should be able to execute agent_orchestration skill', async () => {
    // Create agent
    const createResult = await agent.skillManager.executeSkill('agent_orchestration', 'test-user', {
        operation: 'create_agent',
        name: 'TestBot',
        role: 'Tester'
    });
    
    expect(createResult.success).toBe(true);
    expect(createResult.agentId).toBeDefined();
    
    // List agents
    const listResult = await agent.skillManager.executeSkill('agent_orchestration', 'test-user', {
        operation: 'list_agents'
    });
    
    expect(listResult.agents).toHaveLength(1);
    expect(listResult.agents[0].name).toBe('TestBot');

    // Cleanup
    await agent.skillManager.executeSkill('agent_orchestration', 'test-user', {
        operation: 'remove_agent',
        agentId: createResult.agentId
    });
  });
});
