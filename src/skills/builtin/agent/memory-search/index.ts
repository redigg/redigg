import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';

export default class MemorySearchSkill implements Skill {
  id = 'memory_search';
  name = 'Memory Search';
  description = 'Search through research notes, conversation history, and preferences stored in memory.';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query or keyword to find in memories.',
      },
      type: {
        type: 'string',
        enum: ['preference', 'fact', 'context', 'paper', 'experiment', 'page_index', 'page_index_node'],
        description: 'Optional filter by memory type.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5, max: 20).',
      }
    },
    required: ['query'],
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const { query, type, limit = 5 } = params;

    if (!query) {
      throw new Error('Search query is required.');
    }

    ctx.log('thinking', `Searching memories for: "${query}"${type ? ` (type: ${type})` : ''}`);

    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const options: any = { limit: safeLimit };
    if (type) {
      options.type = type;
    }

    try {
      const results = await ctx.memory.searchMemories(ctx.userId, query, options);
      
      if (!results || results.length === 0) {
        return {
          success: true,
          message: `No memories found matching "${query}".`,
          results: [],
        };
      }

      const formattedResults = results.map(r => ({
        id: r.id,
        type: r.type,
        tier: r.tier,
        content: r.content,
        metadata: r.metadata,
        created_at: r.created_at,
        weight: r.weight,
      }));

      ctx.log('action', `Found ${results.length} matching memories.`);

      return {
        success: true,
        count: results.length,
        results: formattedResults,
      };
    } catch (error: any) {
      ctx.log('error', `Memory search failed: ${error.message}`);
      throw new Error(`Failed to search memories: ${error.message}`);
    }
  }
}
