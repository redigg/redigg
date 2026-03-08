import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { SkillEvolutionSystem } from '../../../src/skills/evolution/SkillEvolutionSystem.js';
import path from 'path';

export default class EvolutionSkill implements Skill {
  id = 'evolution';
  name = 'Evolution';
  description = 'Self-evolve by creating or improving skills';
  tags = ['system', 'evolution', 'meta'];

  private evoSystem: SkillEvolutionSystem | null = null;

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const operation = params.operation || 'create_skill';
    
    // Lazy init of the evolution system to avoid circular dependency issues at startup if possible
    if (!this.evoSystem) {
        // Dynamic import to avoid circular dependency
        const { SkillManager } = await import('../../../src/skills/SkillManager.js');
        
        // We need to point to the correct skills directory
        // Assuming current file is in skills/evolution/index.ts, we want to go up to skills/
        const skillsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); 
        // Or just use process.cwd()/skills which is safer for now
        const projectRoot = process.cwd();
        
        const tempSkillManager = new SkillManager(ctx.llm, ctx.memory, projectRoot);
        // Load existing skills so the EvoSystem knows what exists
        await tempSkillManager.loadSkillsFromDisk();
        
        // Point EvoSystem to the 'skills' directory, NOT 'src/skills/impl/generated'
        // This is crucial: we want new skills to land in the main skills folder
        const targetSkillsDir = path.join(projectRoot, 'skills');
        
        this.evoSystem = new SkillEvolutionSystem(tempSkillManager, ctx.llm, targetSkillsDir);
    }

    ctx.log('thinking', `Performing evolution operation: ${operation}`);

    try {
      switch (operation) {
        case 'create_skill':
          const intent = params.intent;
          if (!intent) throw new Error('Intent is required for creation');
          
          const result = await this.evoSystem.evolveSkill(intent, params.feedback);
          
          if (result) {
            ctx.log('tool_result', `Successfully evolved skill: ${result.skillId}`);
            return { 
                success: true, 
                skillId: result.skillId,
                message: 'New skill created. It will be available after reload or dynamic registration.' 
            };
          } else {
            return { success: false, message: 'No new skill was generated (maybe not needed).' };
          }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      ctx.log('error', `Evolution failed: ${error}`);
      throw error;
    }
  }
}
