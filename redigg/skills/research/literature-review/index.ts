import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { ScholarTool } from '../../../src/skills/lib/ScholarTool.js';
import chalk from 'chalk';

export default class LiteratureReviewSkill implements Skill {
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
    
    if (ctx.updateProgress) {
      await ctx.updateProgress(75, 'Synthesizing literature review...');
    }

    const prompt = `
      You are a rigorous academic researcher.
      Write a literature review summary based on the following papers about "${topic}".
      
      CRITICAL INSTRUCTIONS:
      1. ONLY cite papers that are directly relevant to the user's topic.
      2. If a paper in the list below is irrelevant, ignore it completely.
      3. At the end of your summary, provide a "Selected Sources" list containing ONLY the papers you actually used/cited in the text.
      4. Do not include a "Sources" list if you didn't use any.

      Available Papers:
      ${papers.map((p, i) => `[${i+1}] ${p.title} (${p.year}): ${p.summary}`).join('\n')}

      Output Format:
      <Summary text with inline citations like [1]>

      **Selected Sources:**
      [1] Title (Year)
      ...
    `;
    
    const summaryResponse = await ctx.llm.complete(prompt);
    const summary = summaryResponse.content;

    // Parse the LLM response to extract the actually used papers
    // This is a heuristic: we trust the LLM's "Selected Sources" list or we could parse inline citations.
    // For now, let's rely on the LLM's output for the summary, but we need to filter the `papers` array returned in result
    // to match what the user sees.
    
    // Actually, the `ResearchAgent.ts` constructs the final response string using `result.papers`.
    // So we should update `result.papers` to only include relevant ones.
    
    // Let's ask the LLM to output a JSON list of indices of used papers to be precise.
    
    const promptRefinement = `
      Based on the summary you just wrote, which of the provided papers (by index 1-${papers.length}) were actually relevant and cited?
      Return ONLY a JSON array of numbers, e.g., [1, 3, 5]. If none, return [].
    `;
    
    // This second call might be expensive. Alternatively, we can just ask for the filtered list in the first prompt 
    // and parse it. Let's try a single prompt approach with structured output if possible, 
    // or just strict formatting.
    
    // Let's stick to the prompt update above, but we need to parse the "Selected Sources" section 
    // to filter the `papers` array returned to the agent.
    
    // Simple parsing: check if paper title appears in the "Selected Sources" section of the response.
    const relevantPapers = papers.filter(p => summary.includes(p.title));
    
    // If the heuristic fails (LLM changes title format), we fall back to all papers 
    // OR we can just return the summary as is (which includes the sources list) 
    // and pass an empty array for papers so the Agent doesn't duplicate the list.
    
    // ResearchAgent.ts does: 
    // const response = ... result.summary ... \n\n**Sources:**\n${result.papers.map(...)}
    
    // So if we include sources in the summary, we should return empty papers to Agent, 
    // OR we strip sources from summary and return filtered papers.
    
    // Let's strip the "Selected Sources" from the LLM output and return the filtered list.
    
    let finalSummary = summary;
    let finalPapers = papers;

    if (summary.includes('**Selected Sources:**')) {
        const parts = summary.split('**Selected Sources:**');
        finalSummary = parts[0].trim();
        const sourcesText = parts[1];
        
        // Filter papers based on what's in sourcesText
        finalPapers = papers.filter(p => sourcesText.includes(p.title) || sourcesText.includes(p.summary.slice(0, 20)));
    } else if (summary.includes('Selected Sources:')) {
        const parts = summary.split('Selected Sources:');
        finalSummary = parts[0].trim();
        const sourcesText = parts[1];
        finalPapers = papers.filter(p => sourcesText.includes(p.title) || sourcesText.includes(p.summary.slice(0, 20)));
    } else {
        // Fallback: if no explicit sources section, try to filter by inline citations or titles in text
        // This is safer than returning all papers if the user specifically asked to filter.
        // But if LLM didn't follow format, we might lose all sources.
        // Let's keep all papers if format wasn't followed, or maybe try to match titles in summary.
        const papersInText = papers.filter(p => summary.includes(p.title));
        if (papersInText.length > 0) {
            finalPapers = papersInText;
        }
    }

    if (ctx.updateProgress) {
      await ctx.updateProgress(100, `Completed analysis. Selected ${finalPapers.length} relevant sources.`);
    }

    ctx.log('result', `Completed literature review on ${topic}`, {
      papers_count: finalPapers.length,
      summary_length: finalSummary.length
    });

    return {
      topic,
      summary: finalSummary,
      papers: finalPapers
    };
  }
}
