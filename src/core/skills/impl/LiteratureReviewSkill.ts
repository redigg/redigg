import { Skill, SkillContext, SkillParams, SkillResult } from '../types.js';
import { ScholarTool } from '../lib/ScholarTool.js';
import chalk from 'chalk';

export class LiteratureReviewSkill implements Skill {
  id = 'literature_review';
  name = 'Literature Review';
  description = 'Search for papers and generate a literature review';
  tags = ['research', 'literature', 'review'];

  private scholar = new ScholarTool();

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const topic = params.topic;
    if (!topic) {
      throw new Error('Topic is required');
    }

    ctx.log('thinking', `Starting literature review on topic: ${topic}`);

    if (ctx.updateProgress) {
      await ctx.updateProgress(10, `Starting literature review on ${topic}`);
    }

    // 1. Search Papers
    ctx.log('action', 'Initializing academic search');
    ctx.log('tool_call', 'Searching for papers', {
      tool_name: 'ScholarSearch',
      tool_args: { topic, limit: 5 }
    });

    const papers = await this.scholar.searchPapers(topic, 5);

    ctx.log('tool_result', `Found ${papers.length} relevant papers`, {
      tool_name: 'ScholarSearch',
      papers_count: papers.length
    });
    
    if (ctx.updateProgress) {
      await ctx.updateProgress(50, `Found ${papers.length} papers, analyzing...`);
    }

    // 2. Add to Memory (Memory Injection)
    for (const paper of papers) {
      // Simulate memory addition (in a real scenario, this would persist the paper as a memory)
      // Actually, we can use ctx.memory.addPaper() if available, but SkillContext might not have it directly exposed as `addPaper` if it's generic
      // But we have `memory` which is `MemoryManager`, so we can call it.
      if (ctx.memory && typeof (ctx.memory as any).addPaper === 'function') {
         await (ctx.memory as any).addPaper(
           ctx.userId, 
           paper.title, 
           paper.authors, 
           paper.url, 
           paper.summary
         );
      }
    }

    // 3. Generate Summary
    ctx.log('thinking', 'Synthesizing literature review');
    const prompt = `
      Write a literature review summary based on the following papers about "${topic}":
      ${papers.map(p => `- ${p.title} (${p.year}): ${p.summary}`).join('\n')}
    `;
    
    const summaryResponse = await ctx.llm.complete(prompt);
    const summary = summaryResponse.content;

    ctx.log('result', `Completed literature review on ${topic}`, {
      papers_count: papers.length,
      summary_length: summary.length
    });

    return {
      topic,
      summary,
      papers
    };
  }
}
