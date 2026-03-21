import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

export default class PaperSummarizerSkill implements Skill {
  id = 'paper_summarizer';
  name = 'Paper Summarizer';
  description = 'Generate a concise, structured summary of a single paper given its full text or abstract.';
  tags = ['research', 'literature', 'summarize'];

  parameters = {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The full text or abstract of the paper to summarize.' },
      focus: { type: 'string', description: 'Optional specific aspect to focus on (e.g., "methodology", "limitations", "datasets used").' }
    },
    required: ['text']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const text = params.text;
    const focus = params.focus;

    ctx.log('thinking', `Summarizing paper text (Length: ${text.length} chars)${focus ? ` with focus on: ${focus}` : ''}`);

    let prompt = `You are an expert academic reviewer. Please provide a concise, structured summary of the following academic text.

Format your output exactly with these headings:
- **Core Contribution**: (1-2 sentences summarizing the main novelty)
- **Methodology**: (Brief explanation of how they did it)
- **Key Findings**: (Main results or metrics)
- **Limitations**: (Any weaknesses mentioned or implied)

Text to summarize:
"""
${text}
"""`;

    if (focus) {
      prompt += `\n\nAdditionally, please ensure your summary specifically addresses and highlights this aspect: "${focus}".`;
    }

    try {
      const response = await ctx.llm.complete(prompt);
      
      return {
        status: 'success',
        summary: response.content,
        focus: focus || 'general'
      };
    } catch (error: any) {
      return {
        status: 'failed',
        message: `Failed to summarize paper: ${error.message}`
      };
    }
  }
}
