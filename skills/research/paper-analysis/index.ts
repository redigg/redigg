import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { ScholarTool } from '../../../src/skills/lib/ScholarTool.js';

export default class PaperAnalysisSkill implements Skill {
  id = 'paper_analysis';
  name = 'Paper Analysis';
  description = 'Analyze a scientific paper in depth';
  tags = ['research', 'analysis', 'critique'];

  private scholar = new ScholarTool();

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const paperTitle = params.paper_title || params.title || params.query;
    if (!paperTitle) {
      throw new Error('Paper title is required');
    }

    ctx.log('thinking', `Analyzing paper: ${paperTitle}`);
    if (ctx.updateProgress) await ctx.updateProgress(10, `Searching for paper: ${paperTitle}`);

    // 1. Search for the paper to get metadata/summary if we don't have full text
    // In a real system, we might download the PDF here.
    ctx.log('action', 'Searching for paper details...');
    const papers = await this.scholar.searchPapers(paperTitle, 1);
    
    if (papers.length === 0) {
        throw new Error(`Paper not found: ${paperTitle}`);
    }

    const paper = papers[0];
    ctx.log('thinking', `Found paper: ${paper.title} (${paper.year})`);
    if (ctx.updateProgress) await ctx.updateProgress(40, `Found paper: ${paper.title}`);

    // 2. Analyze using LLM
    // Since we can't read the full PDF yet (ScholarTool just gets metadata/abstract),
    // we will ask the LLM to analyze based on its internal knowledge + the abstract.
    // If we had PDF reading capability, we'd feed the text here.
    
    const prompt = `
      You are an expert research scientist.
      Please perform a deep analysis of the following paper:
      
      Title: ${paper.title}
      Authors: ${paper.authors.join(', ')}
      Year: ${paper.year}
      Abstract: ${paper.summary}
      URL: ${paper.url || 'N/A'}

      If you have internal knowledge about this specific paper (based on title/authors), please use it to enrich the analysis.
      
      Structure your response as follows:
      1. **Executive Summary**: 2-3 sentences.
      2. **Key Contributions**: Bullet points.
      3. **Methodology**: How did they do it?
      4. **Results**: What did they find?
      5. **Critique & Limitations**: What are the weaknesses?
      6. **Relevance**: Why does this matter?
    `;

    if (ctx.updateProgress) await ctx.updateProgress(60, `Analyzing content...`);

    const response = await ctx.llm.complete(prompt);
    const analysis = response.content;

    if (ctx.updateProgress) await ctx.updateProgress(100, `Analysis complete.`);

    return {
      paper: paper,
      analysis: analysis,
      formatted_output: `### Paper Analysis: ${paper.title}\n\n${analysis}\n\n[View Paper](${paper.url})`
    };
  }
}
