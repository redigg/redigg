import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

export default class GapAnalyzerSkill implements Skill {
  id = 'gap_analyzer';
  name = 'Research Gap Analyzer';
  description = 'Analyzes a set of provided paper abstracts or summaries to identify missing links, contradictions, or unexplored areas in the current literature.';
  tags = ['research', 'idea', 'analysis', 'gap'];

  parameters = {
    type: 'object',
    properties: {
      literature_summary: { type: 'string', description: 'A concatenated string of paper abstracts, findings, or a literature review summary.' },
      domain: { type: 'string', description: 'The specific academic domain or sub-field.' }
    },
    required: ['literature_summary', 'domain']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const literature = params.literature_summary;
    const domain = params.domain;

    ctx.log('thinking', `Analyzing literature for research gaps in domain: ${domain}`);

    const prompt = `You are an expert reviewer in the field of ${domain}. Read the following literature summary and identify the top 3-5 critical research gaps. 

A research gap can be:
- An unexplored variable or condition
- A contradiction between different papers
- A methodological weakness in current approaches
- A lack of application in a specific sub-domain

Literature Summary:
${literature}

Provide the output as a structured Markdown document. For each gap, include:
- **Gap Title**
- **Description**: Detailed explanation of what is missing.
- **Evidence**: Which parts of the provided literature suggest this gap.
- **Potential Impact**: Why filling this gap would be valuable to the field.`;

    try {
      const response = await ctx.llm.complete(prompt);
      
      return {
        success: true,
        gaps: response.content,
        domain
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to analyze gaps: ${error.message}`
      };
    }
  }
}
