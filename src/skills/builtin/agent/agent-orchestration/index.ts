import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';
import { SubAgentManager } from '../../../../agent/subagent/SubAgentManager.js';
import { SubAgentTask } from '../../../../agent/subagent/SubAgent.js';
import { SkillManager } from '../../../SkillManager.js';
import path from 'path';

export default class AgentOrchestrationSkill implements Skill {
  id = 'agent_orchestration';
  name = 'Agent Orchestration';
  description = 'Create and manage sub-agents';
  tags = ['system', 'agent', 'orchestration'];

  // Static instance to persist agents across skill executions in the same process
  private static manager: SubAgentManager | null = null;

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const operation = params.operation || 'list_agents';

    if (!AgentOrchestrationSkill.manager) {
        // Initialize manager
        // We need a SkillManager instance. We can create a new one sharing the same config.
        const projectRoot = process.cwd();
        const skillManager = new SkillManager(ctx.llm, ctx.memory, projectRoot);
        await skillManager.loadSkillsFromDisk();
        
        AgentOrchestrationSkill.manager = new SubAgentManager(ctx.llm, ctx.memory, skillManager);
    }

    const manager = AgentOrchestrationSkill.manager;

    ctx.log('thinking', `Performing agent orchestration: ${operation}`);

    try {
      switch (operation) {
        case 'create_agent':
          const name = params.name;
          const role = params.role;
          if (!name || !role) throw new Error('Name and role are required');
          
          const agent = manager.createSubAgent(name, role);
          ctx.log('tool_result', `Created agent ${name} (${agent.id})`);
          return { success: true, agentId: agent.id, name: agent.name };

        case 'list_agents':
          const agents = manager.getAllSubAgents();
          return { 
              agents: agents.map(a => ({ id: a.id, name: a.name, role: a.role })) 
          };

        case 'delegate':
          const agentId = params.agentId;
          const taskDesc = params.task;
          const skills = params.skills || [];
          
          if (!agentId || !taskDesc) throw new Error('AgentId and task are required');
          
          const subAgent = manager.getSubAgent(agentId);
          if (!subAgent) throw new Error(`Agent ${agentId} not found`);
          
          const task: SubAgentTask = {
              id: Date.now().toString(),
              description: taskDesc,
              status: 'pending',
              requiredSkills: skills
          };
          
          const result = await subAgent.executeTask(task);
          return { success: true, result: result };

        case 'remove_agent':
          const removeId = params.agentId;
          if (!removeId) throw new Error('AgentId is required');
          manager.terminateSubAgent(removeId);
          return { success: true, message: 'Agent removed' };

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      ctx.log('error', `Orchestration failed: ${error}`);
      throw error;
    }
  }
}
