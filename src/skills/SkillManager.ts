import { Skill, SkillContext, SkillParams, SkillResult, SkillPack } from './types.js';
import { LLMClient } from '../llm/LLMClient.js';
import { MemoryManager } from '../memory/MemoryManager.js';
import { createLogger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';

const logger = createLogger('SkillManager');

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private packs: Map<string, SkillPack> = new Map();
  private llm: LLMClient;
  private memoryManager: MemoryManager;
  private workspace: string;
  private skillsDir: string;

  constructor(
    llm: LLMClient, 
    memoryManager: MemoryManager, 
    workspace: string = process.cwd(),
    private managers?: SkillContext['managers']
  ) {
    this.llm = llm;
    this.memoryManager = memoryManager;
    this.workspace = workspace;
    this.skillsDir = path.join(workspace, 'skills');
  }

  public setManagers(managers: SkillContext['managers']) {
      this.managers = managers;
  }

  public registerSkill(skill: Skill) {
    this.skills.set(skill.id, skill);
  }

  public registerPack(pack: SkillPack) {
    this.packs.set(pack.id, pack);
    for (const skill of pack.skills) {
      this.registerSkill(skill);
    }
  }

  public unloadPack(packId: string) {
    const pack = this.packs.get(packId);
    if (pack) {
      for (const skill of pack.skills) {
        this.skills.delete(skill.id);
      }
      this.packs.delete(packId);
    }
  }

  public async loadSkillsFromDisk() {
    try {
        const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const itemPath = path.join(this.skillsDir, entry.name);
                
                // Check if it's a Pack (has PACK.md)
                const packMdPath = path.join(itemPath, 'PACK.md');
                
                try {
                    await fs.access(packMdPath);
                    // It's a Pack
                    await this.loadPack(itemPath, entry.name);
                    continue;
                } catch (e) {
                    // Not a pack
                }
                
                // Check if it's a Skill (has SKILL.md or just index.ts?)
                const skillMdPath = path.join(itemPath, 'SKILL.md');
                const indexTsPath = path.join(itemPath, 'index.ts');

                try {
                    await fs.access(skillMdPath);
                    // It's a Skill with metadata
                    await this.loadSkill(itemPath);
                } catch (e) {
                    // Maybe it's a skill without metadata?
                    try {
                        await fs.access(indexTsPath);
                        await this.loadSkill(itemPath);
                    } catch (e2) {
                        // Not a skill
                    }
                }
            }
        }
    } catch (e) {
        logger.warn(`Failed to load skills from disk: ${e}`);
    }
  }

  private async loadSkill(skillPath: string): Promise<Skill | null> {
    const implPath = path.join(skillPath, 'index.ts');
    try {
        await fs.access(implPath);
    } catch (e) {
        // If index.ts does not exist, it might be a non-TS skill or just a placeholder.
        // We skip it without error.
        return null;
    }

    try {
        // Use pathToFileURL to handle ESM import properly on all platforms
        const { pathToFileURL } = await import('url');
        // Add a timestamp query param to bust the cache when reloading
        const moduleUrl = `${pathToFileURL(implPath).href}?t=${Date.now()}`;
        const module = await import(moduleUrl);
        
        if (module.default) {
            const skillInstance = new module.default();
            // Check if it's a valid skill
            if (skillInstance.id && skillInstance.execute) {
                // Check for duplicates
                if (this.skills.has(skillInstance.id)) {
                    logger.debug(`Overwriting existing skill: ${skillInstance.id}`);
                }
                
                this.skills.set(skillInstance.id, skillInstance);
                logger.info(`Registered skill: ${skillInstance.id}`);
                return skillInstance;
            }
        }
    } catch (e) {
        logger.error(`Failed to load skill from ${implPath}: ${e}`);
    }
    return null;
  }

  private async loadPack(packPath: string, packId: string) {
    logger.info(`Loading skill pack: ${packId}`);
    const pack: SkillPack = {
        id: packId,
        name: packId, // TODO: Parse from PACK.md
        description: '',
        skills: [],
        path: packPath
    };

    // Scan for sub-directories which are skills
    const entries = await fs.readdir(packPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillPath = path.join(packPath, entry.name);
            
            // Wait, if it's 'heartbeat' (no SKILL.md), loadSkill should still work because it looks for index.ts
            // But verify loadSkill logic
            
            const skill = await this.loadSkill(skillPath);
            if (skill) {
                // Assign packId to skill for organization
                (skill as any).packId = packId;
                pack.skills.push(skill);
            }
        }
    }
    
    this.packs.set(pack.id, pack);
    logger.info(`Registered pack: ${packId} with ${pack.skills.length} skills`);
  }

  public getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  public getPack(id: string): SkillPack | undefined {
    return this.packs.get(id);
  }

  public getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  public getAllPacks(): SkillPack[] {
    return Array.from(this.packs.values());
  }

  public getSkillStats(): any {
    return {
        totalSkills: this.skills.size,
        totalPacks: this.packs.size,
        skills: Array.from(this.skills.values()).map(s => ({ 
            id: s.id, 
            name: s.name,
            packId: (s as any).packId
        })),
        packs: Array.from(this.packs.values()).map(p => ({ id: p.id, skillsCount: p.skills.length }))
    };
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
      managers: this.managers,
      log: onLog || ((type, content, metadata) => {
        logger.info(`[Skill:${skillId}] [${type}] ${content}`, metadata || '');
      }),
      updateProgress: async (progress, description) => {
        logger.info(`[Skill:${skillId}] [PROGRESS] ${progress}% - ${description}`);
      },
      addTodo: async (content, priority) => {
        logger.info(`[Skill:${skillId}] [TODO] [${priority}] ${content}`);
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
