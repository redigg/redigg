import { Skill, SkillContext, SkillParams, SkillResult, SkillPack } from './types.js';
import { LLMClient } from '../llm/LLMClient.js';
import { MemoryManager } from '../memory/MemoryManager.js';
import { createLogger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';

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

                let loaded = false;

                try {
                    await fs.access(skillMdPath);
                    // It's a Skill with metadata
                    // Try to parse SKILL.md to see if it's an OpenClaw skill (metadata block)
                    const content = await fs.readFile(skillMdPath, 'utf-8');
                    const match = content.match(/^---\n([\s\S]*?)\n---/);
                    if (match) {
                        try {
                            const meta = yaml.load(match[1]) as any;
                            // Check if there is an index.ts implementing our Skill interface
                            try {
                                await fs.access(indexTsPath);
                                await this.loadSkill(itemPath);
                                loaded = true;
                            } catch (e) {
                                // No index.ts, so it's a pure OpenClaw skill (markdown only or external bin)
                                // We wrap it in a ShellSkill
                                logger.info(`Adapting OpenClaw skill: ${path.basename(itemPath)}`);
                                
                                // Create a dynamic ShellSkill
                                const skillName = path.basename(itemPath);
                                const description = meta.description || '';
                                
                                const shellSkill: Skill = {
                                    id: skillName,
                                    name: meta.name || skillName,
                                    description: description,
                                    // version: '1.0.0', // Skill interface does not have version
                                    execute: async (ctx, params) => {
                                        ctx.log('thinking', `Executing external skill: ${skillName} with params: ${JSON.stringify(params)}`);
                                        
                                        // For now, just a placeholder implementation
                                        if (skillName === 'agent-browser') {
                                             const { exec } = await import('child_process');
                                             const util = await import('util');
                                             const execAsync = util.promisify(exec);
                                             
                                             // Example: agent-browser open <url>
                                             if (params.command) {
                                                 const cmd = `agent-browser ${params.command}`;
                                                 ctx.log('action', `Running: ${cmd}`);
                                                 try {
                                                     const { stdout, stderr } = await execAsync(cmd);
                                                     return { stdout, stderr, success: true };
                                                 } catch (err: any) {
                                                     return { error: err.message, success: false };
                                                 }
                                             }
                                        }

                                        return { 
                                            success: true, 
                                            message: `Executed OpenClaw skill ${skillName} (Simulation)`,
                                            meta 
                                        };
                                    }
                                };
                                this.registerSkill(shellSkill);
                            // This duplication in loadSkillsFromDisk is legacy.
                            // The actual fix should be in loadPack.
                            // Let's just keep it clean here.
                            
                            loaded = true;
                            }
                        } catch (e) {
                            // Invalid YAML
                        }
                    } else {
                        // Standard skill
                        await this.loadSkill(itemPath);
                        loaded = true;
                    }
                } catch (e) {
                    // No SKILL.md or parsing failed
                }

                if (!loaded) {
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

  private async loadSkill(skillPath: string, packId?: string): Promise<Skill | null> {
    const implPath = path.join(skillPath, 'index.ts');
    try {
        await fs.access(implPath);
        
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
        // Only log error if file exists but failed to load (e.g. syntax error)
        // If file doesn't exist (fs.access fails), we just return null silently
        // But we need to distinguish between ENOENT and other errors
        if ((e as any).code !== 'ENOENT') {
             logger.error(`Failed to load skill from ${implPath}: ${e}`);
        }
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
    
    // Register pack first so we can add skills to it
    this.packs.set(pack.id, pack);

    // Scan for sub-directories which are skills
    const entries = await fs.readdir(packPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillPath = path.join(packPath, entry.name);
            
            // Check if it's a Skill (has SKILL.md or just index.ts?)
            const skillMdPath = path.join(skillPath, 'SKILL.md');
            const indexTsPath = path.join(skillPath, 'index.ts');

            let loaded = false;

            try {
                await fs.access(skillMdPath);
                // It's a Skill with metadata
                // Try to parse SKILL.md to see if it's an OpenClaw skill (metadata block)
                const content = await fs.readFile(skillMdPath, 'utf-8');
                const match = content.match(/^---\n([\s\S]*?)\n---/);
                if (match) {
                    try {
                        const meta = yaml.load(match[1]) as any;
                        
                        // Check if there is an index.ts implementing our Skill interface
                        try {
                            await fs.access(indexTsPath);
                            const skill = await this.loadSkill(skillPath, packId);
                            if (skill) {
                                (skill as any).packId = packId;
                                pack.skills.push(skill);
                            }
                            loaded = true;
                        } catch (e) {
                            // No index.ts, so it's a pure OpenClaw skill (markdown only or external bin)
                            // We wrap it in a ShellSkill
                            logger.info(`Adapting OpenClaw skill: ${path.basename(skillPath)}`);
                            
                            // Create a dynamic ShellSkill
                            const skillName = path.basename(skillPath);
                            const description = meta.description || '';
                            
                            const shellSkill: Skill = {
                                id: skillName,
                                name: meta.name || skillName,
                                description: description,
                                // version: '1.0.0', // Skill interface does not have version
                                execute: async (ctx, params) => {
                                    // Use 'action' log type which is valid
                                    if (ctx.log) ctx.log('action', `Executing external skill: ${skillName} with params: ${JSON.stringify(params)}`);
                                    
                                    // For now, just a placeholder implementation
                                    if (skillName === 'agent-browser') {
                                         const { exec } = await import('child_process');
                                         const util = await import('util');
                                         const execAsync = util.promisify(exec);
                                         
                                         // Example: agent-browser open <url>
                                         if (params.command) {
                                             const cmd = `agent-browser ${params.command}`;
                                             if (ctx.log) ctx.log('action', `Running: ${cmd}`);
                                             try {
                                                 const { stdout, stderr } = await execAsync(cmd);
                                                 return { stdout, stderr, success: true };
                                             } catch (err: any) {
                                                 return { error: err.message, success: false };
                                             }
                                         }
                                    }

                                    return { 
                                        success: true, 
                                        message: `Executed OpenClaw skill ${skillName} (Simulation)`,
                                        meta 
                                    };
                                }
                            };
                            this.registerSkill(shellSkill);
                            logger.info(`Registered skill: ${shellSkill.id}`);
                            (shellSkill as any).packId = packId;
                            pack.skills.push(shellSkill);
                            
                            loaded = true;
                        }
                    } catch (e) {
                        // Invalid YAML
                    }
                } else {
                    // Standard skill
                    const skill = await this.loadSkill(skillPath, packId);
                    if (skill) {
                        (skill as any).packId = packId;
                        pack.skills.push(skill);
                    }
                    loaded = true;
                }
            } catch (e) {
                // No SKILL.md or parsing failed
            }

            if (!loaded) {
                // Try standard loading (index.ts) if not already loaded
                try {
                    await fs.access(indexTsPath);
                    const skill = await this.loadSkill(skillPath, packId);
                    if (skill) {
                        (skill as any).packId = packId;
                        pack.skills.push(skill);
                        loaded = true;
                    }
                } catch (e2) {
                    // Not a skill
                }
            }
        }
    }
    
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
      const result = await skill.execute(context, params);
      
      // Emit event if EventManager is available
      if (this.managers && this.managers.event) {
          this.managers.event.emit('skill:executed', { skillId, result });
      }
      
      return result;
    } catch (error) {
      context.log('error', `Execution failed: ${error}`);
      throw error;
    }
  }
}
