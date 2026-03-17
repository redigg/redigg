import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { ScholarTool, type Paper } from '../../../src/skills/lib/ScholarTool.js';
import { createSurveyOutline, refineOutline } from './outline.js';
import { retrieveSurveyPapers } from './retriever.js';
import { writeSurveySections } from './section-writer.js';
import { reviewSurveySections } from './reviewer.js';
import { assembleSurvey } from './assembler.js';
import { dedupePapers } from './utils.js';

export default class AcademicSurveySelfImproveSkill implements Skill {
  id = 'academic_survey_self_improve';
  name = 'Academic Survey (Self-Improve)';
  description = 'Conducts an academic survey and iteratively refines it.';
  tags = ['research', 'survey', 'academic'];

  async execute(context: SkillContext, params: SkillParams): Promise<SkillResult> {
    const { topic, depth = 'brief' } = params;
    context.log('thinking', `Starting academic survey on: ${topic}`);
    await context.updateProgress?.(10, 'Initializing search', { topic, depth });

    // Depth-aware retrieval parameters
    const retrievalParams = depth === 'deep'
      ? { sectionLimit: 8, perQueryLimit: 6, snowballMaxSeeds: 8, snowballPerPaper: 5 }
      : depth === 'standard'
        ? { sectionLimit: 6, perQueryLimit: 5, snowballMaxSeeds: 6, snowballPerPaper: 4 }
        : { sectionLimit: 4, perQueryLimit: 4, snowballMaxSeeds: 5, snowballPerPaper: 3 };
    const seedLimit = depth === 'deep' ? 8 : depth === 'standard' ? 6 : 5;

    const scholar = new ScholarTool();
    let seedPapers = await scholar.searchPapers(topic, seedLimit);

    if (seedPapers.length === 0) {
      context.log('thinking', 'No papers found. Attempting to broaden search...');
      await context.updateProgress?.(20, 'No results found, refining query...', { originalTopic: topic });
      const betterQuery = await this.refineQuery(context, topic);

      if (betterQuery !== topic) {
        context.log('thinking', `Refined query to: ${betterQuery}`);
        await context.updateProgress?.(25, `Searching with refined query: ${betterQuery}`);
        seedPapers = await scholar.searchPapers(betterQuery, 5);
      }
    }

    if (seedPapers.length === 0) {
      await context.updateProgress?.(100, 'Survey failed: No papers found');
      return {
        success: false,
        topic,
        depth,
        message: 'No papers found even after refinement.',
        summary: '',
        papers: [],
        sources: [],
        outline: null,
        sections: [],
        quality_report: null,
        formatted_output: ''
      };
    }

    await context.updateProgress?.(30, 'Planning survey outline', { seedPaperCount: seedPapers.length });
    let outline = await createSurveyOutline(context, topic, seedPapers, depth);

    await context.updateProgress?.(42, 'Retrieving evidence for each section', { sectionCount: outline.sections.length });
    let retrieval = await retrieveSurveyPapers(scholar, topic, outline, seedPapers, retrievalParams);

    // Iterative outline refinement: adjust outline based on actual retrieval results
    await context.updateProgress?.(52, 'Refining outline based on retrieval results');
    const refinedOutline = await refineOutline(context, topic, outline, retrieval.papersBySection, depth);
    if (refinedOutline !== outline) {
      context.log('thinking', `Outline refined: ${refinedOutline.sections.map((s) => s.title).join(', ')}`);
      outline = refinedOutline;
      // Re-retrieve for any new/changed sections
      await context.updateProgress?.(58, 'Re-retrieving evidence for refined outline');
      retrieval = await retrieveSurveyPapers(scholar, topic, outline, seedPapers, retrievalParams);
    }

    const papers = dedupePapers(retrieval.papers);
    const paperIndexMap = new Map(papers.map((paper, index) => [paper.title.toLowerCase(), index + 1]));

    await this.persistPapers(context, papers);

    await context.updateProgress?.(70, 'Writing section drafts', {
      sectionCount: outline.sections.length,
      deduplicatedPapers: retrieval.searchMetadata.deduplicatedCount
    });
    const draftedSections = await writeSurveySections(context, topic, outline, retrieval.papersBySection, paperIndexMap);

    await context.updateProgress?.(85, 'Reviewing and refining survey sections', {
      sectionCount: draftedSections.length
    });
    const reviewed = await reviewSurveySections(context, topic, draftedSections);

    await context.updateProgress?.(95, 'Assembling final survey document', {
      overallScore: reviewed.qualityReport.overallScore
    });
    const finalSurvey = assembleSurvey(outline, reviewed.sections, papers, reviewed.qualityReport);

    await context.updateProgress?.(100, 'Survey complete', {
      wordCount: finalSurvey.wordCount,
      citationCount: finalSurvey.citationCount,
      overallScore: reviewed.qualityReport.overallScore
    });

    // Use referencedPapers (only papers actually cited in body) for scoring,
    // but keep all retrieved papers in retrieval_metadata for analysis
    const referencedPapers = finalSurvey.referencedPapers;

    return {
      success: true,
      topic,
      depth,
      summary: finalSurvey.markdown,
      papers: referencedPapers,
      sources: referencedPapers,
      outline,
      sections: reviewed.sections,
      quality_report: reviewed.qualityReport,
      formatted_output: finalSurvey.markdown,
      final_survey: finalSurvey,
      retrieval_metadata: {
        ...retrieval.searchMetadata,
        totalRetrieved: papers.length,
        referencedCount: referencedPapers.length
      }
    };
  }

  private async refineQuery(context: SkillContext, originalQuery: string): Promise<string> {
    const prompt = `The user searched for "${originalQuery}" on arXiv but found no results. Suggest a broader or more effective search query for the same intent. Return ONLY the new query string.`;
    const response = await context.llm.chat([{ role: 'user', content: prompt }]);
    return response.content.trim().replace(/^"|"$/g, '');
  }

  private async persistPapers(context: SkillContext, papers: Paper[]): Promise<void> {
    for (const paper of papers) {
      if (context.memory && typeof (context.memory as any).addPaper === 'function') {
        await (context.memory as any).addPaper(
          context.userId,
          paper.title,
          paper.authors || [],
          paper.url,
          paper.summary
        );
      }
    }
  }
}
