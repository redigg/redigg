export interface SkillResult {
  success: boolean;
  content: string;
  data?: any;
  error?: string;
}

export interface Skill {
  execute(ctx: SkillContext): Promise<SkillResult>;
}

export class MathAlgorithmHelper implements Skill {
  static readonly metadata = {
    id: 'math_algorithm_helper',
    name: 'Math Algorithm Helper',
    description: 'Provides explanations, mathematical formulas, and code snippets for calculating sequences and solving algorithmic problems.',
    tags: ['math', 'algorithms', 'computation']
  };

  async execute(ctx: SkillContext): Promise<SkillResult> {
    ctx.log('thinking', 'Initializing Math Algorithm Helper skill...');

    try {
      // Retrieve the user's query from memory. 
      // Assuming standard memory key convention for current user intent.
      const userQuery = await ctx.memory.get('current_intent') || 'Explain common mathematical algorithms.';
      
      ctx.log('action', `Processing query: "${userQuery}"`);

      const systemPrompt = `You are an expert Math Algorithm Helper. 
      Your goal is to provide clear explanations, mathematical formulas, and code snippets (preferably TypeScript/JavaScript) for calculating sequences and solving algorithmic problems.
      
      Structure your response as follows:
      1. **Concept Explanation**: Briefly explain the algorithm.
      2. **Mathematical Formula**: Provide the recurrence relation or formula using LaTeX style if possible.
      3. **Code Snippet**: Provide a clean, efficient implementation.
      4. **Complexity Analysis**: Time and Space complexity.

      User Query: ${userQuery}`;

      ctx.log('tool_call', 'Invoking LLM for algorithmic explanation...');

      const response = await ctx.llm.complete(systemPrompt);

      ctx.log('tool_result', 'LLM response received successfully.');

      if (!response || typeof response !== 'string') {
        throw new Error('Invalid response format from LLM');
      }

      ctx.log('result', 'Skill execution completed successfully.');

      return {
        success: true,
        content: response,
        data: {
          algorithmType: 'general',
          source: 'llm_generation'
        }
      };

    } catch (error: any) {
      ctx.log('error', `Skill execution failed: ${error.message}`);
      
      return {
        success: false,
        content: '',
        error: error.message || 'Unknown error occurred during math algorithm processing.'
      };
    }
  }
}