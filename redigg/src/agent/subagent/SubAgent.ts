import { v4 as uuidv4 } from 'uuid';
import { LLMClient } from '../../llm/LLMClient.js';
import { MemoryManager } from '../../memory/MemoryManager.js';
import { SkillManager } from '../../skills/SkillManager.js';
import { SkillContext, SkillResult } from '../../skills/types.js';

export interface SubAgentTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  requiredSkills?: string[]; // IDs of skills needed for this task
}

export class SubAgent {
  public id: string;
  public name: string;
  public role: string;
  private llm: LLMClient;
  private memoryManager: MemoryManager;
  private skillManager: SkillManager;
  private currentTask?: SubAgentTask;

  constructor(
    name: string,
    role: string,
    llm: LLMClient,
    memoryManager: MemoryManager,
    skillManager: SkillManager
  ) {
    this.id = uuidv4();
    this.name = name;
    this.role = role;
    this.llm = llm;
    this.memoryManager = memoryManager;
    this.skillManager = skillManager;
  }

  public async executeTask(task: SubAgentTask): Promise<SubAgentTask> {
    this.currentTask = { ...task, status: 'running' };
    console.log(`[SubAgent:${this.name}] Starting task: ${task.description}`);

    try {
      // 1. Plan: Determine which skills to use
      // For MVP, if requiredSkills are provided, use them.
      // If not, we might need a planning step (future).
      
      let result: any = {};
      
      if (task.requiredSkills && task.requiredSkills.length > 0) {
        for (const skillId of task.requiredSkills) {
          console.log(`[SubAgent:${this.name}] Executing skill: ${skillId}`);
          try {
            // Determine params based on task description (simplified)
            // In a real agent, we'd use LLM to extract params from description
            const params = await this.extractParamsForSkill(skillId, task.description);
            
            const skillResult = await this.skillManager.executeSkill(
              skillId, 
              'subagent-' + this.id, 
              params,
              (type, content) => console.log(`[SubAgent:${this.name}] [${type}] ${content}`)
            );
            
            result[skillId] = skillResult;
          } catch (e) {
            console.error(`[SubAgent:${this.name}] Skill ${skillId} failed:`, e);
            result[skillId] = { error: String(e) };
          }
        }
      } else {
        // Pure LLM task
        const response = await this.llm.chat([
            { role: 'system', content: `You are ${this.name}, a ${this.role}.` },
            { role: 'user', content: task.description }
        ]);
        result = { response: response.content };
      }

      this.currentTask.status = 'completed';
      this.currentTask.result = result;
      console.log(`[SubAgent:${this.name}] Task completed.`);
    } catch (error) {
      this.currentTask.status = 'failed';
      this.currentTask.error = String(error);
      console.error(`[SubAgent:${this.name}] Task failed:`, error);
    }

    return this.currentTask;
  }

  private async extractParamsForSkill(skillId: string, description: string): Promise<any> {
      // Use LLM to extract JSON params
      const skill = this.skillManager.getSkill(skillId);
      if (!skill) return {};

      const prompt = `
        Task: "${description}"
        Skill: "${skill.name}" (${skill.description})
        
        Extract parameters for this skill from the task description as a JSON object.
        If no specific parameters found, return empty object {}.
        Output JSON only.
      `;
      
      try {
        const response = await this.llm.chat([
            { role: 'system', content: 'You are a parameter extractor.' },
            { role: 'user', content: prompt }
        ]);
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch (e) {
          return {};
      }
  }
}
