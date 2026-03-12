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
    private managers?: SkillContext['managers'],
    private systemSkillsDir?: string,
  ) {
    this.llm = llm;
    this.memoryManager = memoryManager;
    this.workspace = workspace;
    this.skillsDir = path.join(workspace, 'skills');
    // this.registerSkill(new PdfGeneratorSkill());
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
    // Load from workspace (user skills)
    await this.loadSkillsFromDir(this.skillsDir);
    
    // Load from system (built-in skills)
    if (this.systemSkillsDir) {
        await this.loadSkillsFromDir(this.systemSkillsDir);
    }
  }

  private async loadSkillsFromDir(dir: string) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const itemPath = path.join(dir, entry.name);
                
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
                
                // Check if it's a Skill (has SKILL.md or just index.ts/js?)
                // ... (rest of logic)
                await this.loadSkill(itemPath);
            }
        }
    } catch (e) {
        // If workspace skills dir missing, just warn if it's the main workspace
        if (dir === this.skillsDir && (e as any).code !== 'ENOENT') {
             logger.warn(`Failed to load skills from ${dir}: ${e}`);
        }
    }
  }

  private async loadSkill(skillPath: string): Promise<Skill | null> {
    const skillId = path.basename(skillPath);
    let implPath = path.join(skillPath, 'index.ts');
    
    // Check for .js if .ts not found
    try {
        await fs.access(implPath);
    } catch {
        implPath = path.join(skillPath, 'index.js');
    }

    // 1. Try loading executable skill (index.ts/js)
    try {
        await fs.access(implPath);
        // ... import logic
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
    } catch (e: any) {
        // If index.ts/js missing or load failed, fall through to check SKILL.md
        if (e.code !== 'ENOENT') {
             logger.error(`Failed to load skill from ${implPath}: ${e}`);
        }
    }

    // 2. Try loading declarative skill (SKILL.md)
    // ...
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    try {
        const content = await fs.readFile(skillMdPath, 'utf-8');
        const frontmatter = this.parseFrontmatter(content);
        
        if (frontmatter.name) {
            const skill: Skill = {
                id: skillId,
                name: frontmatter.name,
                description: frontmatter.description || 'No description provided.',
                tags: ['vendor', 'declarative'],
                execute: async (ctx, params) => {
                    return {
                        success: true,
                        message: `This is a declarative skill (${frontmatter.name}). It provides tools or capabilities but cannot be executed directly.`
                    };
                }
            };
            
            this.skills.set(skill.id, skill);
            logger.info(`Registered declarative skill: ${skill.id}`);
            return skill;
        }
    } catch (e) {
        // Ignore if SKILL.md missing
    }

    return null;
  }

  private parseFrontmatter(content: string): { name?: string; description?: string } {
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return {};
      
      const yaml = match[1];
      const result: any = {};
      
      const nameMatch = yaml.match(/^name:\s*(.*)$/m);
      if (nameMatch) result.name = nameMatch[1].trim();
      
      const descMatch = yaml.match(/^description:\s*(.*)$/m);
      if (descMatch) result.description = descMatch[1].trim();
      
      return result;
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
    handlers?: {
        onLog?: SkillContext['log'];
        onProgress?: SkillContext['updateProgress'];
        onTodo?: SkillContext['addTodo'];
    } | SkillContext['log']
  ): Promise<SkillResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    // Handle legacy signature where 4th arg was just onLog function
    let onLog = handlers as any;
    let onProgress = undefined;
    let onTodo = undefined;

    if (typeof handlers === 'object' && handlers !== null && !('apply' in handlers)) {
        onLog = handlers.onLog;
        onProgress = handlers.onProgress;
        onTodo = handlers.onTodo;
    } else if (typeof handlers === 'function') {
        onLog = handlers;
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
      updateProgress: onProgress || (async (progress, description, metadata) => {
        logger.info(`[Skill:${skillId}] [PROGRESS] ${progress}% - ${description}`, metadata);
      }),
      addTodo: onTodo || (async (content, priority, step_number) => {
        logger.info(`[Skill:${skillId}] [TODO] [${priority}] ${content} (step ${step_number})`);
      }),
      updateTodo: async (todoId, status, content) => {
          logger.info(`[Skill:${skillId}] [TODO_UPDATE] ${todoId} -> ${status}`);
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
