import { ScholarTool, type Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { OutlineSection, RetrievalResult, SectionDraft, SurveyOutline } from './types.js';
import { assessPaperAnchors, countWords, dedupePapers, filterPapersByAnchors, normalizeText, parseJsonObject, scorePaperForSection } from './utils.js';

// ─── R2: Semantic reranking ──────────────────────────────────────────

/**
 * Use LLM to score and rerank papers for a section.
 * Scores top candidates by actual relevance to the section's focus.
 * Falls back to the original order if the LLM call fails.
 */
export async function semanticRerankPapers(
  context: SkillContext,
  papers: Paper[],
  section: OutlineSection,
  topK: number
): Promise<Paper[]> {
  if (papers.length === 0) return papers;

  // Only rerank up to 12 candidates; rest are returned in original order after
  const candidates = papers.slice(0, 12);
  const rest = papers.slice(12);

  const candidateList = candidates.map((p, i) => {
    const summary = p.summary ? p.summary.slice(0, 200) : 'No summary';
    return `${i + 1}. "${p.title}" (${p.year || 'n/d'}) - ${summary}`;
  }).join('\n');

  const prompt = `Score each paper's relevance to the survey section described below.

Section: "${section.title}"
Description: ${section.description || section.title}
Focus facets: ${(section.focusFacets || []).join(', ') || 'general'}

Papers to score:
${candidateList}

Return ONLY a JSON array of scores (0-10) in the same order as the papers above.
10 = directly and specifically relevant to this section's focus
5 = partially relevant, touches related topics
0 = off-topic or only tangentially related

Example: [8, 3, 10, 2, 7, 1, 6, 9, 4, 5, 0, 8]
Return ONLY the JSON array, no explanation.`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You score academic paper relevance. Return only a JSON array of numbers.' },
      { role: 'user', content: prompt }
    ]);
    const content = normalizeText(response.content);
    // Extract JSON array from response
    const match = content.match(/\[[\d,\s.]+\]/);
    if (!match) return papers.slice(0, topK);

    const scores = parseJsonObject<number[]>(match[0]);
    if (!Array.isArray(scores) || scores.length !== candidates.length) {
      return papers.slice(0, topK);
    }

    // Sort candidates by score descending
    const scored = candidates.map((paper, i) => ({ paper, score: scores[i] || 0 }));
    scored.sort((a, b) => b.score - a.score);

    const reranked = [...scored.map((s) => s.paper), ...rest];
    return reranked.slice(0, topK);
  } catch {
    return papers.slice(0, topK);
  }
}

interface RetrieveOptions {
  sectionLimit?: number;
  perQueryLimit?: number;
  enableSnowball?: boolean;
  snowballMaxSeeds?: number;
  snowballPerPaper?: number;
  /** If provided, enables R2 semantic reranking of paper candidates */
  context?: SkillContext;
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
    // R2: Semantic reranking — if LLM context is available, rerank the anchor-filtered candidates
    // by actual relevance to the section. This improves citationRecall beyond keyword matching.
    const lexicalRanked = rankPapersForSection(anchorFiltered, section, outline.topicProfile);
    const ranked = options.context && lexicalRanked.length > 1
      ? await semanticRerankPapers(options.context, lexicalRanked, section, sectionLimit)
      : lexicalRanked.slice(0, sectionLimit);

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

// ─── T6: Gap-filling supplementary retrieval ────────────────────────

interface GapAnalysis {
  sectionId: string;
  sectionTitle: string;
  gaps: string[];
  supplementaryQueries: string[];
}

/**
 * Analyze drafted sections to identify evidence gaps, then retrieve
 * supplementary papers to fill those gaps. Returns updated papersBySection
 * with newly found papers merged in.
 */
export async function fillRetrievalGaps(
  context: SkillContext,
  scholar: ScholarTool,
  outline: SurveyOutline,
  sections: SectionDraft[],
  existingPapers: Paper[],
  papersBySection: Record<string, Paper[]>,
  options: { perQueryLimit?: number; maxGapQueries?: number } = {}
): Promise<{ papersBySection: Record<string, Paper[]>; papers: Paper[]; gapsFilled: number }> {
  const perQueryLimit = options.perQueryLimit ?? 3;
  const maxGapQueries = options.maxGapQueries ?? 2;
  const shouldDelay = !(process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');

  // Step 1: identify gaps via LLM
  const gaps = await analyzeGaps(context, outline, sections);
  if (gaps.length === 0) {
    return { papersBySection, papers: existingPapers, gapsFilled: 0 };
  }

  // Step 2: retrieve supplementary papers for each gap
  let gapsFilled = 0;
  const allNewPapers: Paper[] = [];

  for (const gap of gaps) {
    const queries = gap.supplementaryQueries.slice(0, maxGapQueries);
    const section = outline.sections.find((s) => s.id === gap.sectionId);
    if (!section || queries.length === 0) continue;

    for (const query of queries) {
      if (shouldDelay) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const hits = await scholar.searchPapers(query, perQueryLimit);
      const useful = outline.topicProfile
        ? filterBatchByRelevance(hits, section, outline.topicProfile)
        : hits;
      allNewPapers.push(...useful);
    }

    // Merge new papers into this section
    const current = papersBySection[gap.sectionId] || [];
    const merged = dedupePapers([...current, ...allNewPapers]);
    const filtered = outline.topicProfile
      ? filterPapersByAnchors(merged, outline.topicProfile, section, current.length + 3)
      : merged;
    if (filtered.length > current.length) {
      papersBySection[gap.sectionId] = filtered;
      gapsFilled++;
    }
  }

  const papers = dedupePapers([...existingPapers, ...allNewPapers]);
  return { papersBySection, papers, gapsFilled };
}

async function analyzeGaps(
  context: SkillContext,
  outline: SurveyOutline,
  sections: SectionDraft[]
): Promise<GapAnalysis[]> {
  const sectionSummaries = sections.map((s) => {
    const wc = countWords(s.content);
    const citeCount = new Set(Array.from(s.content.matchAll(/\[(\d+)\]/g)).map((m) => m[1])).size;
    return `- ${s.title} (${wc} words, ${citeCount} citations, ${s.evidenceCards.length} evidence cards)`;
  }).join('\n');

  const prompt = `Analyze these survey sections for evidence gaps.

Survey topic: ${outline.title}
Sections:
${sectionSummaries}

For each section that has a gap, suggest 1-2 targeted search queries that would fill that gap.
A "gap" means: a section that (1) has fewer than 3 evidence cards, OR (2) lacks a specific sub-topic mentioned in the outline but not covered in the draft, OR (3) relies on a single paper for most claims.

Return ONLY valid JSON array (empty [] if no gaps):
[
  {
    "sectionId": "section_id",
    "sectionTitle": "Section Title",
    "gaps": ["description of gap"],
    "supplementaryQueries": ["search query 1", "search query 2"]
  }
]`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You analyze academic survey sections for evidence gaps.' },
      { role: 'user', content: prompt }
    ]);
    const parsed = parseJsonObject<GapAnalysis[]>(normalizeText(response.content));
    if (Array.isArray(parsed)) {
      return parsed.filter((g) =>
        g.sectionId && g.supplementaryQueries && g.supplementaryQueries.length > 0
      );
    }
    return [];
  } catch {
    return [];
  }
}
