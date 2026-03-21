import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

export default class HypothesisGeneratorSkill implements Skill {
  id = 'hypothesis_generator';
  name = 'Hypothesis Generator';
  description = 'Generates novel, testable research hypotheses based on a provided topic and a list of background papers or context.';
  tags = ['research', 'idea', 'brainstorming', 'hypothesis'];

  parameters = {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'The core research topic or problem domain.' },
      context: { type: 'string', description: 'Summary of background literature or current state of the art to base hypotheses on.' },
      count: { type: 'number', description: 'Number of hypotheses to generate (default 3).' }
    },
    required: ['topic', 'context']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const topic = params.topic;
    const contextStr = params.context;
    const count = params.count || 3;

    ctx.log('thinking', `Generating ${count} hypotheses for topic: ${topic}`);

    const prompt = `You are a senior academic researcher. Based on the following research topic and background context, generate ${count} novel, highly specific, and testable research hypotheses.

Topic: ${topic}

Background Context:
${contextStr}

For each hypothesis, provide:
1. The Hypothesis Statement
2. Rationale (Why this makes sense based on the context)
3. Proposed Methodology (A brief idea of how it could be tested or evaluated)

Format the output as a clear Markdown list.`;

    try {
      const response = await ctx.llm.complete(prompt);
      
      return {
        success: true,
        hypotheses: response.content,
        topic
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate hypotheses: ${error.message}`
      };
    }
  }
}
