import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { ScholarTool } from '../../../src/skills/lib/ScholarTool.js';

export default class AcademicSurveySelfImproveSkill implements Skill {
  id = 'academic_survey_self_improve';
  name = 'Academic Survey (Self-Improve)';
  description = 'Conducts an academic survey and iteratively refines it.';
  tags = ['research', 'survey', 'academic'];

  async execute(context: SkillContext, params: SkillParams): Promise<SkillResult> {
    const { topic, depth = 'brief' } = params;
    context.log('thinking', `Starting academic survey on: ${topic}`);

    const scholar = new ScholarTool();
    let papers = await scholar.searchPapers(topic, 5);

    if (papers.length === 0) {
      context.log('thinking', 'No papers found. Attempting to broaden search...');
      const betterQuery = await this.refineQuery(context, topic);
      if (betterQuery !== topic) {
          context.log('thinking', `Refined query to: ${betterQuery}`);
          papers = await scholar.searchPapers(betterQuery, 5);
      }
    }

    if (papers.length === 0) {
      return { 
        success: false, 
        message: 'No papers found even after refinement.',
        papers: []
      };
    }

    context.log('thinking', `Found ${papers.length} papers. Analyzing...`);

    // Summarize
    const summary = await this.summarizePapers(context, topic, papers);

    return {
      success: true,
      summary,
      papers,
      formatted_output: summary
    };
  }

  private async refineQuery(context: SkillContext, originalQuery: string): Promise<string> {
      const prompt = `The user searched for "${originalQuery}" on arXiv but found no results. Suggest a broader or more effective search query for the same intent. Return ONLY the new query string.`;
      const response = await context.llm.chat([{ role: 'user', content: prompt }]);
      return response.content.trim().replace(/^"|"$/g, '');
  }

  private async summarizePapers(context: SkillContext, topic: string, papers: any[]): Promise<string> {
      const papersText = papers.map((p, i) => `[${i+1}] ${p.title} (${p.year})\nSummary: ${p.summary}`).join('\n\n');
      const prompt = `
      Perform a literature survey on the topic: "${topic}".
      Based on the following papers found:
      
      ${papersText}
      
      Synthesize a coherent summary of the state of research. Highlight key trends, methodologies, and findings.
      Format as Markdown.
      `;
      
      const response = await context.llm.chat([{ role: 'user', content: prompt }]);
      return response.content;
  }
}
