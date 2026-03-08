import { Skill, SkillContext, SkillParams, SkillResult } from '../../src/skills/types.js';

export default class MemoryManagementSkill implements Skill {
  id = 'memory_management';
  name = 'Memory Management';
  description = 'Manage and consolidate agent memories';
  tags = ['memory', 'system', 'consolidation'];

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const operation = params.operation || 'consolidate';
    const userId = params.userId || ctx.userId;

    ctx.log('thinking', `Performing memory operation: ${operation} for user ${userId}`);

    try {
      switch (operation) {
        case 'consolidate':
          await ctx.memory.consolidateMemories(userId);
          ctx.log('tool_result', 'Memory consolidation completed.');
          return { success: true, message: 'Memories consolidated.' };

        case 'search':
          const query = params.query;
          if (!query) throw new Error('Search query is required');
          const results = await ctx.memory.searchMemories(userId, query, {
            limit: params.limit,
            type: params.type,
            tier: params.tier
          });
          ctx.log('tool_result', `Found ${results.length} memories matching "${query}"`);
          return { results };

        case 'retrieve':
          const tier = params.tier;
          if (!tier) throw new Error('Tier is required for retrieval');
          const memories = await ctx.memory.getMemoriesByTier(userId, tier);
          ctx.log('tool_result', `Retrieved ${memories.length} ${tier} memories`);
          return { memories };
        
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      ctx.log('error', `Memory operation failed: ${error}`);
      throw error;
    }
  }
}
