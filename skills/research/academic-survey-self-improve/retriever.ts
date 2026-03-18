import { ScholarTool, type Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { OutlineSection, RetrievalResult, SurveyOutline } from './types.js';
import { assessPaperAnchors, dedupePapers, filterPapersByAnchors, scorePaperForSection } from './utils.js';

interface RetrieveOptions {
  sectionLimit?: number;
  perQueryLimit?: number;
  enableSnowball?: boolean;
  snowballMaxSeeds?: number;
  snowballPerPaper?: number;
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
  // Track papers already assigned to previous sections — used for diversity scoring
  const assignedPaperTitles = new Set<string>();

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
    const seedFallback = filterPapersByAnchors(
      rankPapersForSection(seedPapers, section, outline.topicProfile),
      outline.topicProfile,
      section,
      Math.min(sectionLimit, 2)
    ).slice(0, sectionLimit);

    // Apply cross-section diversity: deprioritize papers already assigned to earlier sections
    const diversified = applyDiversityPenalty(ranked.length > 0 ? ranked : seedFallback, assignedPaperTitles, sectionLimit);
    papersBySection[section.id] = diversified;

    // Record assigned papers for subsequent sections
    for (const paper of diversified) {
      assignedPaperTitles.add(paper.title.toLowerCase());
    }
  }

  let papers = dedupePapers([
    ...seedPapers,
    ...Object.values(papersBySection).flat()
  ]);

  // Snowball expansion: follow citation graph from retrieved papers
  if (options.enableSnowball !== false) {
    const snowballPapers = await expandViaCitationGraph(
      scholar,
      papers,
      outline,
      {
        maxSeeds: options.snowballMaxSeeds ?? 5,
        perPaperLimit: options.snowballPerPaper ?? 3
      }
    );

    if (snowballPapers.length > 0) {
      // Assign snowball papers to sections based on relevance
      for (const section of outline.sections) {
        const current = papersBySection[section.id] || [];
        const currentCount = current.length;
        if (currentCount >= sectionLimit) continue;

        const ranked = rankPapersForSection(snowballPapers, section, outline.topicProfile);
        const filtered = filterPapersByAnchors(
          ranked,
          outline.topicProfile,
          section,
          sectionLimit - currentCount
        );
        const toAdd = filtered.slice(0, sectionLimit - currentCount);
        if (toAdd.length > 0) {
          papersBySection[section.id] = dedupePapers([...current, ...toAdd]);
        }
      }

      papers = dedupePapers([
        ...papers,
        ...snowballPapers
      ]);
      totalHits += snowballPapers.length;
    }
  }

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

/**
 * One round of citation graph expansion (snowball retrieval).
 * Picks top-cited seed papers, fetches their references & citers,
 * filters by topic relevance.
 */
async function expandViaCitationGraph(
  scholar: ScholarTool,
  seedPapers: Paper[],
  outline: SurveyOutline,
  options: { maxSeeds: number; perPaperLimit: number }
): Promise<Paper[]> {
  try {
    const expanded = await scholar.expandCitationGraph(seedPapers, options);

    if (!outline.topicProfile || expanded.length === 0) return expanded;

    // Filter: only keep papers with at least weak relevance to any section
    return expanded.filter((paper) => {
      for (const section of outline.sections) {
        const assessment = assessPaperAnchors(paper, outline.topicProfile!, section);
        if (assessment.tier !== 'off-topic') return true;
      }
      return false;
    });
  } catch {
    return [];
  }
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

/** Filter a search batch: keep only papers with at least weak section relevance.
 *  If a batch is mostly noise, drop the noise instead of letting it spill into evidence cards. */
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

  // If batch is mostly off-topic, still keep the relevant minority instead of the whole batch.
  return relevant.map((item) => item.paper);
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

/**
 * Re-sort papers to promote diversity: papers not yet assigned to any previous
 * section are boosted; papers already used elsewhere are pushed down.
 * Guarantees at least `limit` papers are returned, filling with repeats if needed.
 */
function applyDiversityPenalty(
  papers: Paper[],
  assignedTitles: Set<string>,
  limit: number
): Paper[] {
  if (assignedTitles.size === 0 || papers.length === 0) return papers.slice(0, limit);

  const fresh = papers.filter((p) => !assignedTitles.has(p.title.toLowerCase()));
  const reused = papers.filter((p) => assignedTitles.has(p.title.toLowerCase()));

  // Prefer fresh papers, but keep at least 1 reused paper for cross-section coherence
  const result = [...fresh, ...reused].slice(0, limit);
  return result.length > 0 ? result : papers.slice(0, limit);
}
