import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

export default class LiteratureReviewSkill implements Skill {
  id = 'literature_review';
  name = 'Literature Review Generator';
  description = 'Generate structured literature reviews by orchestrating atomic search tools (arxiv, semantic scholar).';
  tags = ['research', 'idea', 'review'];

  parameters = {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'The research topic to review' },
      max_papers: { type: 'number', description: 'Maximum number of papers to retrieve per source (default: 3)' }
    },
    required: ['topic']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const topic = params.topic;
    const maxPapers = params.max_papers || 3;

    ctx.log('thinking', `Starting literature review on: "${topic}" with max ${maxPapers} papers per source.`);

    if (!ctx.managers?.skill) {
      throw new Error('SkillManager not available in context. Cannot orchestrate built-in skills.');
    }

    const allPapers: any[] = [];

    ctx.log('action', `Querying paper search for: ${topic}`);
    let results: any = null;
    try {
      results = await ctx.managers.skill.executeSkill('paper_search', ctx.userId, {
        query: topic,
        max_results: maxPapers
      });
    } catch (e: any) {
      ctx.log('error', `Paper search failed: ${e.message}`);
    }

    if (!results || !results.papers || results.papers.length === 0) {
        return {
            status: 'failed',
            message: `Could not find any papers for topic: ${topic}`
        };
    }

    allPapers.push(...results.papers);

    ctx.log('thinking', `Aggregated ${allPapers.length} papers. Generating summary...`);

    const summaryPrompt = `
You are an expert researcher. Please write a structured literature review based on the following papers retrieved for the topic: "${topic}".

Papers:
${JSON.stringify(allPapers, null, 2)}

Please provide:
1. An Executive Summary
2. Key Themes and Trends
3. Summary of Individual Papers
4. Identified Gaps or Future Directions
`;

    const summaryResponse = await ctx.llm.complete(summaryPrompt);
    const reviewContent = summaryResponse.content;

    ctx.log('action', `Saving literature review to file.`);
    const filename = `literature_review_${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    
    try {
        await ctx.managers.skill.executeSkill('local_file_ops', ctx.userId, {
            operation: 'write',
            path: filename,
            content: reviewContent
        });
        ctx.log('result', `Saved review to ${filename}`);
    } catch (e: any) {
        ctx.log('error', `Failed to save review to file: ${e.message}`);
        // Fallback to just returning the content if file save fails
    }

    return { 
      status: 'success',
      topic: topic,
      papers_analyzed: allPapers.length,
      file_saved: filename,
      review: reviewContent
    };
  }
}
