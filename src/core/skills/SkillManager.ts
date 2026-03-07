import { Skill, SkillContext, SkillParams, SkillResult } from './types.js';
import { LLMClient } from '../llm/LLMClient.js';
import { MemoryManager } from '../memory/MemoryManager.js';
import path from 'path';

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private llm: LLMClient;
  private memoryManager: MemoryManager;
  private workspace: string;

  constructor(llm: LLMClient, memoryManager: MemoryManager, workspace: string = process.cwd()) {
    this.llm = llm;
    this.memoryManager = memoryManager;
    this.workspace = workspace;
  }

  public registerSkill(skill: Skill) {
    this.skills.set(skill.id, skill);
  }

  public getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  public getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  public async executeSkill(
    skillId: string, 
    userId: string, 
    params: SkillParams,
    onLog?: SkillContext['log']
  ): Promise<SkillResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    const context: SkillContext = {
      llm: this.llm,
      memory: this.memoryManager,
      workspace: this.workspace,
      userId,
      log: onLog || ((type, content, metadata) => {
        console.log(`[Skill:${skillId}] [${type}] ${content}`, metadata || '');
      }),
      updateProgress: async (progress, description) => {
        console.log(`[Skill:${skillId}] [PROGRESS] ${progress}% - ${description}`);
      },
      addTodo: async (content, priority) => {
        console.log(`[Skill:${skillId}] [TODO] [${priority}] ${content}`);
      }
    };

    try {
      return await skill.execute(context, params);
    } catch (error) {
      context.log('error', `Execution failed: ${error}`);
      throw error;
    }
  }
}
