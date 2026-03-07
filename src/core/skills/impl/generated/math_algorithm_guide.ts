export interface Skill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  execute(context: SkillContext, input: string): Promise<SkillResult>;
}

export interface SkillResult {
  success: boolean;
  content: string;
  data?: any;
}

export class MathAlgorithmGuide implements Skill {
  public readonly id: string = 'math_algorithm_guide';
  public readonly name: string = 'Math Algorithm Guide';
  public readonly description: string = 'Provides explanations, formulas, and methods for calculating mathematical sequences and solving algorithmic problems.';
  public readonly tags: string[] = ['math', 'algorithms', 'computation'];

  public async execute(ctx: SkillContext, input: string): Promise<SkillResult> {
    try {
      ctx.log('thinking', `Initializing math algorithm guide for input: ${input}`);

      const systemPrompt = `You are an expert mathematical algorithm guide. 
      Your goal is to provide clear explanations, formulas, and step-by-step methods for calculating mathematical sequences or solving algorithmic problems.
      If code is helpful, provide pseudocode or TypeScript snippets.
      Ensure accuracy in formulas.`;

      const userPrompt = `User Query: ${input}

      Please provide a detailed explanation, relevant formulas, and a method to solve or calculate this.`;

      ctx.log('action', 'Calling LLM for mathematical reasoning', { promptLength: userPrompt.length });

      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      // Assuming ctx.llm.complete returns a Promise<string>
      const response = await ctx.llm.complete(fullPrompt);

      ctx.log('tool_result', 'LLM response received', { responseLength: response.length });

      if (!response || response.trim().length === 0) {
        throw new Error('LLM returned an empty response');
      }

      ctx.log('result', 'Successfully generated math guide', { success: true });

      return {
        success: true,
        content: response,
        data: {
          query: input,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      ctx.log('error', `Failed to execute math algorithm guide: ${errorMessage}`);
      
      return {
        success: false,
        content: `Unable to process the mathematical query at this time. Error: ${errorMessage}`,
        data: {
          error: errorMessage
        }
      };
    }
  }
}