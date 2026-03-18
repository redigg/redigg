import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { ScholarTool, type Paper } from '../../../src/skills/lib/ScholarTool.js';
import { createSurveyOutline, refineOutline } from './outline.js';
import { fillRetrievalGaps, retrieveSurveyPapers } from './retriever.js';
import { writeSurveySections } from './section-writer.js';
import { reviewSurveySections } from './reviewer.js';
import { assembleSurvey } from './assembler.js';
import { generateSurveyFigures } from './figure-generator.js';
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

    // Depth-aware retrieval parameters — scaled for ≥40 ref target
    const retrievalParams = depth === 'deep'
      ? { sectionLimit: 14, perQueryLimit: 8, snowballMaxSeeds: 12, snowballPerPaper: 6 }
      : depth === 'standard'
        ? { sectionLimit: 12, perQueryLimit: 8, snowballMaxSeeds: 10, snowballPerPaper: 5 }
        : { sectionLimit: 6, perQueryLimit: 5, snowballMaxSeeds: 6, snowballPerPaper: 3 };
    const seedLimit = depth === 'deep' ? 12 : depth === 'standard' ? 10 : 5;

    const useCache = params.useCache === true || process.env.SCHOLAR_CACHE === 'true';
    const scholar = new ScholarTool(useCache ? { enabled: true } : undefined);
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

    await context.updateProgress?.(65, 'Writing section drafts', {
      sectionCount: outline.sections.length,
      deduplicatedPapers: retrieval.searchMetadata.deduplicatedCount
    });
    let currentPapersBySection = retrieval.papersBySection;
    let currentPapers = papers;
    const draftedSections = await writeSurveySections(context, topic, outline, currentPapersBySection, paperIndexMap);

    // T6: Gap-filling supplementary retrieval — analyze drafts for evidence gaps
    await context.updateProgress?.(78, 'Analyzing evidence gaps and retrieving supplementary papers');
    try {
      const gapResult = await fillRetrievalGaps(
        context, scholar, outline, draftedSections, currentPapers, currentPapersBySection,
        { perQueryLimit: retrievalParams.perQueryLimit, maxGapQueries: 3 }
      );
      if (gapResult.gapsFilled > 0) {
        context.log('thinking', `Filled ${gapResult.gapsFilled} evidence gaps with supplementary retrieval`);
        currentPapersBySection = gapResult.papersBySection;
        currentPapers = gapResult.papers;
        // Rebuild paper index with new papers
        const allPapers = dedupePapers(currentPapers);
        const updatedIndexMap = new Map(allPapers.map((p, i) => [p.title.toLowerCase(), i + 1]));
        // Re-write sections that got new evidence
        const sectionsToRewrite = draftedSections.filter((s) => {
          const oldCount = (retrieval.papersBySection[s.sectionId] || []).length;
          const newCount = (currentPapersBySection[s.sectionId] || []).length;
          return newCount > oldCount;
        });
        if (sectionsToRewrite.length > 0) {
          context.log('thinking', `Re-writing ${sectionsToRewrite.length} sections with new evidence`);
          const rewritten = await writeSurveySections(
            context, topic, outline, currentPapersBySection, updatedIndexMap
          );
          // Merge: replace only sections that had gaps filled
          const rewrittenIds = new Set(sectionsToRewrite.map((s) => s.sectionId));
          for (let i = 0; i < draftedSections.length; i++) {
            if (rewrittenIds.has(draftedSections[i].sectionId)) {
              const replacement = rewritten.find((r) => r.sectionId === draftedSections[i].sectionId);
              if (replacement) draftedSections[i] = replacement;
            }
          }
        }
      }
    } catch {
      // Gap-filling is non-critical; continue without it
    }

    await context.updateProgress?.(85, 'Reviewing and refining survey sections', {
      sectionCount: draftedSections.length
    });
    const reviewed = await reviewSurveySections(context, topic, draftedSections);

    // Generate figures for key sections
    await context.updateProgress?.(90, 'Generating survey figures and diagrams');
    let figures: Awaited<ReturnType<typeof generateSurveyFigures>> = [];
    try {
      figures = await generateSurveyFigures(context, outline, reviewed.sections);
      if (figures.length > 0) {
        context.log('thinking', `Generated ${figures.length} figures for survey`);
      }
    } catch {
      // Figure generation is non-critical
    }

    await context.updateProgress?.(95, 'Assembling final survey document', {
      overallScore: reviewed.qualityReport.overallScore
    });
    const finalSurvey = await assembleSurvey(outline, reviewed.sections, papers, reviewed.qualityReport, context, figures);

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
