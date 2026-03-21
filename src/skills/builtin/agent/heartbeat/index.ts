import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';

export default class HeartbeatSkill implements Skill {
  id = 'heartbeat';
  name = 'System Heartbeat';
  description = 'Performs periodic system maintenance and checks';
  tags = ['system', 'maintenance', 'heartbeat'];

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const userId = ctx.userId || 'web-user'; // Default user for system tasks
    
    ctx.log('action', 'Executing heartbeat...');
    
    // 1. Memory Consolidation
    let memoryStats = { moved: 0, promoted: 0, pruned: 0 };
    try {
        if (ctx.memory) {
            // ctx.log('action', 'Consolidating memories...');
            memoryStats = await ctx.memory.consolidateMemories(userId);
            if (memoryStats.moved > 0 || memoryStats.promoted > 0 || memoryStats.pruned > 0) {
                ctx.log('result', `Memory consolidation: Moved ${memoryStats.moved}, Promoted ${memoryStats.promoted}, Pruned ${memoryStats.pruned}`);
            }
        }
    } catch (e) {
        ctx.log('error', `Memory consolidation failed: ${e}`);
    }

    // 2. Skill Evolution Check (Proactive)
    let skillStats = null;
    try {
        if (ctx.managers?.skill) {
             skillStats = (ctx.managers.skill as any).getSkillStats();
             if (skillStats && skillStats.totalSkills > 0) {
                 ctx.log('result', `[Heartbeat] Memory consolidation: Moved ${memoryStats.moved}, Promoted ${memoryStats.promoted}, Pruned ${memoryStats.pruned}`);
                 
                 // Log skill usage
                 const usage = skillStats.skills
                    .filter((s: any) => s.usage && s.usage.used > 0)
                    .map((s: any) => `${s.id}: ${s.usage.success}/${s.usage.failed}`)
                    .join(', ');
                 
                 if (usage) {
                     ctx.log('result', `[Heartbeat] Skill Usage (Success/Fail): ${usage}`);
                 }
             }
        }
    } catch (e) {
        ctx.log('error', `Skill evolution check failed: ${e}`);
    }

    return {
        status: 'completed',
        timestamp: Date.now(),
        memory: memoryStats,
        skills: skillStats
    };
  }
}
