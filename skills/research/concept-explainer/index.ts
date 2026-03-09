import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

export default class ConceptExplainerSkill implements Skill {
  id = 'concept_explainer';
  name = 'Concept Explainer';
  description = 'Explain a complex scientific concept';
  tags = ['research', 'education', 'explanation'];

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const concept = params.concept || params.topic || params.query;
    if (!concept) {
      throw new Error('Concept is required');
    }

    ctx.log('thinking', `Explaining concept: ${concept}`);
    if (ctx.updateProgress) await ctx.updateProgress(10, `Researching concept: ${concept}`);

    const prompt = `
      You are an expert science communicator (like Feynman).
      Explain the following concept in a clear, engaging, and depth-first manner: "${concept}"

      Structure:
      1. **Definition**: Simple, one-sentence definition.
      2. **The "Why"**: Why is this concept important?
      3. **Deep Dive**: How does it work? (Use analogies).
      4. **History**: Who discovered it and when?
      5. **Applications**: Real-world examples.
      6. **Related Concepts**: What else should I know?
    `;

    const response = await ctx.llm.complete(prompt);
    const explanation = response.content;

    if (ctx.updateProgress) await ctx.updateProgress(100, `Explanation ready.`);

    return {
      concept,
      explanation,
      formatted_output: `### Concept: ${concept}\n\n${explanation}`
    };
  }
}
