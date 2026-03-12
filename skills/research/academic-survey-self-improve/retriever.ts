import { ScholarTool, type Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { OutlineSection, RetrievalResult, SurveyOutline } from './types.js';
import { dedupePapers, filterPapersByAnchors, scorePaperForSection } from './utils.js';

interface RetrieveOptions {
  sectionLimit?: number;
  perQueryLimit?: number;
}

export async function retrieveSurveyPapers(
  scholar: ScholarTool,
  topic: string,
  outline: SurveyOutline,
  seedPapers: Paper[],
  options: RetrieveOptions = {}
): Promise<RetrievalResult> {
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
      `${topic} ${section.title}`,
      `${topic} ${section.description}`
    ].map((query) => query.trim()).filter(Boolean)));

    for (const query of queries) {
      queryCount += 1;
      const hits = await scholar.searchPapers(query, perQueryLimit);
      totalHits += hits.length;
      sectionPapers.push(...hits);
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
