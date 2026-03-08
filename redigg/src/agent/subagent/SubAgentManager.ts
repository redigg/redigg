import { SubAgent, SubAgentTask } from './SubAgent.js';
import { LLMClient } from '../../llm/LLMClient.js';
import { MemoryManager } from '../../memory/MemoryManager.js';
import { SkillManager } from '../../skills/SkillManager.js';

export class SubAgentManager {
  private subAgents: Map<string, SubAgent> = new Map();
  private llm: LLMClient;
  private memoryManager: MemoryManager;
  private skillManager: SkillManager;

  constructor(llm: LLMClient, memoryManager: MemoryManager, skillManager: SkillManager) {
    this.llm = llm;
    this.memoryManager = memoryManager;
    this.skillManager = skillManager;
  }

  public createSubAgent(name: string, role: string): SubAgent {
    const subAgent = new SubAgent(name, role, this.llm, this.memoryManager, this.skillManager);
    this.subAgents.set(subAgent.id, subAgent);
    console.log(`[SubAgentManager] Created sub-agent: ${name} (${subAgent.id})`);
    return subAgent;
  }

  public getSubAgent(id: string): SubAgent | undefined {
    return this.subAgents.get(id);
  }

  public getAllSubAgents(): SubAgent[] {
    return Array.from(this.subAgents.values());
  }

  public async executeParallel(tasks: { agentId: string, task: SubAgentTask }[]): Promise<any[]> {
    console.log(`[SubAgentManager] Executing ${tasks.length} tasks in parallel...`);
    
    const promises = tasks.map(async ({ agentId, task }) => {
        const agent = this.subAgents.get(agentId);
        if (!agent) {
            return { taskId: task.id, error: `Agent ${agentId} not found` };
        }
        return await agent.executeTask(task);
    });

    return Promise.all(promises);
  }

  public terminateSubAgent(id: string) {
    this.subAgents.delete(id);
    console.log(`[SubAgentManager] Terminated sub-agent: ${id}`);
  }
}
