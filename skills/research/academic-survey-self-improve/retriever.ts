import { ScholarTool, type Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { OutlineSection, RetrievalResult, SurveyOutline } from './types.js';
import { assessPaperAnchors, dedupePapers, filterPapersByAnchors, scorePaperForSection } from './utils.js';

interface RetrieveOptions {
  sectionLimit?: number;
  perQueryLimit?: number;
}

/** Minimum anchor-tier quality for a batch to count as useful */
const MIN_USEFUL_BATCH_RATIO = 0.25;
/** Once we have this many strong/weak papers for a section, stop querying */
const EARLY_STOP_THRESHOLD = 6;

export async function retrieveSurveyPapers(
  scholar: ScholarTool,
  topic: string,
  outline: SurveyOutline,
  seedPapers: Paper[],
  options: RetrieveOptions = {}
): Promise<RetrievalResult> {
  const shouldDelay = !(process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');
  const sectionLimit = options.sectionLimit ?? 4;
  const perQueryLimit = options.perQueryLimit ?? 4;
  const papersBySection: Record<string, Paper[]> = {};
  let totalHits = 0;
  let queryCount = 0;

  for (const section of outline.sections) {
    const sectionPapers: Paper[] = [];
    const plannedQueries = Array.isArray(section.queryPlan) && section.queryPlan.length > 0
      ? section.queryPlan
          .sort((a, b) => b.weight - a.weight)
          .map((item) => item.query)
      : section.searchQueries;
    const queries = Array.from(new Set([
      ...plannedQueries,
      `${topic} ${section.title}`
    ].map((query) => query.trim()).filter(Boolean)));

    for (const query of queries) {
      // Early stop: if we already have enough quality papers, skip remaining queries
      if (hasEnoughQualityPapers(sectionPapers, section, outline.topicProfile)) {
        break;
      }

      if (queryCount > 0 && shouldDelay) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      queryCount += 1;
      const hits = await scholar.searchPapers(query, perQueryLimit);
      totalHits += hits.length;

      // Batch quality gate: only keep hits that have minimal relevance to the topic
      const useful = filterBatchByRelevance(hits, section, outline.topicProfile);
      sectionPapers.push(...useful);
    }

    const fallbackCandidates = rankPapersForSection(seedPapers, section, outline.topicProfile).slice(0, sectionLimit);
    const dedupedCandidates = dedupePapers([...sectionPapers, ...fallbackCandidates]);
    const anchorFiltered = filterPapersByAnchors(
      dedupedCandidates,
      outline.topicProfile,
      section,
      Math.max(sectionLimit, 3)
    );
    const ranked = rankPapersForSection(anchorFiltered, section, outline.topicProfile)
      .slice(0, sectionLimit);

    papersBySection[section.id] = ranked.length > 0 ? ranked : seedPapers.slice(0, sectionLimit);
  }

  const papers = dedupePapers([
    ...seedPapers,
    ...Object.values(papersBySection).flat()
  ]);

  return {
    papers,
    papersBySection,
    searchMetadata: {
      queryCount,
      totalHits,
      deduplicatedCount: papers.length
    }
  };
}

/** Check if we already have enough strong/weak papers to skip further queries */
function hasEnoughQualityPapers(
  papers: Paper[],
  section: OutlineSection,
  topicProfile?: SurveyOutline['topicProfile']
): boolean {
  if (!topicProfile || papers.length < EARLY_STOP_THRESHOLD) return false;

  const deduped = dedupePapers(papers);
  const qualityCount = deduped.filter((paper) => {
    const assessment = assessPaperAnchors(paper, topicProfile, section);
    return assessment.tier === 'strong' || assessment.tier === 'weak';
  }).length;

  return qualityCount >= EARLY_STOP_THRESHOLD;
}

/** Filter a search batch: keep papers with at least weak relevance; if batch
 *  quality is below threshold, return all (degrade gracefully instead of dropping everything) */
function filterBatchByRelevance(
  papers: Paper[],
  section: OutlineSection,
  topicProfile?: SurveyOutline['topicProfile']
): Paper[] {
  if (!topicProfile || papers.length === 0) return papers;

  const assessed = papers.map((paper) => ({
    paper,
    tier: assessPaperAnchors(paper, topicProfile, section).tier
  }));

  const relevant = assessed.filter((item) => item.tier !== 'off-topic');
  const usefulRatio = relevant.length / papers.length;

  // If most results are relevant, keep only relevant ones
  if (usefulRatio >= MIN_USEFUL_BATCH_RATIO) {
    return relevant.map((item) => item.paper);
  }

  // If batch is mostly off-topic, keep all to avoid losing the few useful ones
  return papers;
}

function rankPapersForSection(
  papers: Paper[],
  section: OutlineSection,
  topicProfile?: SurveyOutline['topicProfile']
): Paper[] {
  const keywords = [
    section.title,
    section.description,
    ...section.searchQueries,
    ...(section.focusFacets || [])
  ]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

  return [...papers].sort((a, b) => {
    const scoreDiff = scorePaperForSection(b, keywords, topicProfile, section)
      - scorePaperForSection(a, keywords, topicProfile, section);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.year || 0) - (a.year || 0);
  });
}
