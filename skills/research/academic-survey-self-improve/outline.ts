import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { ExpandedQuery, OutlineSection, SurveyOutline, TopicProfile } from './types.js';
import { parseJsonObject, slugify } from './utils.js';

const DEPTH_SECTION_COUNT: Record<string, number> = {
  brief: 3,
  standard: 5,
  deep: 6
};

const DEPTH_WORD_COUNT: Record<string, number> = {
  brief: 220,
  standard: 500,
  deep: 900
};

const DEPTH_METHODS_WORD_COUNT: Record<string, number> = {
  brief: 260,
  standard: 600,
  deep: 1000
};

const DEFAULT_INTENT_FACETS = ['survey', 'benchmark', 'system', 'workflow', 'evaluation'];
const DEFAULT_PAPER_TYPES = ['survey', 'review', 'benchmark', 'system', 'framework', 'workflow'];
const MAX_SECTION_QUERIES = 10;

export async function createSurveyOutline(
  context: SkillContext,
  topic: string,
  seedPapers: Paper[],
  depth: string
): Promise<SurveyOutline> {
  const fallback = createFallbackOutline(topic, depth, seedPapers);
  const papersText = seedPapers
    .slice(0, 6)
    .map((paper, index) => `${index + 1}. ${paper.title} (${paper.year}) - ${paper.summary}`)
    .join('\n');

  const prompt = `
[SURVEY_OUTLINE_REQUEST]
You are designing a survey outline for the topic: "${topic}".
Depth: ${depth}
Seed papers:
${papersText}

Return ONLY valid JSON with the following schema:
{
  "title": "string",
  "abstractDraft": "string",
  "taxonomy": ["string"],
  "topicProfile": {
    "anchorTerms": ["string"],
    "aliasPhrases": ["string"],
    "intentFacets": ["string"],
    "preferredPaperTypes": ["string"]
  },
  "sections": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "focusFacets": ["string"],
      "searchQueries": ["string", "string"],
      "targetWordCount": ${DEPTH_WORD_COUNT[depth] || DEPTH_WORD_COUNT.standard}
    }
  ]
}

Constraints:
- Exactly ${DEPTH_SECTION_COUNT[depth] || DEPTH_SECTION_COUNT.standard} sections.
- Section titles MUST include one of these canonical keywords: "Background", "Methods", "Evaluation", "Applications", "Challenges". You may extend the title (e.g. "Background and Scope", "Evaluation and Benchmarks") but the canonical keyword must appear in the title.
- Cover problem setting, methods, evaluation, applications, and open challenges.
- searchQueries must be concrete literature-search queries.
- topicProfile should capture aliases and adjacent academic phrases for retrieval.
- focusFacets should describe the paper types most useful for that section (e.g. survey, benchmark, system).
`;

  const response = await context.llm.chat([
    { role: 'system', content: 'You design structured academic survey outlines.' },
    { role: 'user', content: prompt }
  ]);

  const parsed = parseJsonObject<Partial<SurveyOutline>>(response.content);
  return normalizeOutline(parsed, fallback, topic, depth);
}

function createFallbackOutline(topic: string, depth: string, seedPapers: Paper[]): SurveyOutline {
  const sectionCount = DEPTH_SECTION_COUNT[depth] || DEPTH_SECTION_COUNT.standard;
  const baseSections: OutlineSection[] = [
    {
      id: 'background-and-scope',
      title: 'Background and Scope',
      description: `Define the scope, terminology, and problem setting for ${topic}.`,
      searchQueries: [topic, `${topic} overview`, `${topic} survey`],
      targetWordCount: DEPTH_WORD_COUNT[depth] || DEPTH_WORD_COUNT.standard,
      focusFacets: ['survey', 'review', 'overview']
    },
    {
      id: 'core-methods',
      title: 'Core Methods',
      description: `Summarize the main methodological families used in ${topic}.`,
      searchQueries: [`${topic} methods`, `${topic} framework`, `${topic} model`],
      targetWordCount: DEPTH_METHODS_WORD_COUNT[depth] || DEPTH_METHODS_WORD_COUNT.standard,
      focusFacets: ['methods', 'framework', 'architecture']
    },
    {
      id: 'evaluation-and-benchmarks',
      title: 'Evaluation and Benchmarks',
      description: `Compare datasets, metrics, and empirical findings for ${topic}.`,
      searchQueries: [`${topic} benchmark`, `${topic} evaluation`, `${topic} dataset`],
      targetWordCount: DEPTH_WORD_COUNT[depth] || DEPTH_WORD_COUNT.standard,
      focusFacets: ['benchmark', 'evaluation', 'dataset']
    },
    {
      id: 'applications-and-systems',
      title: 'Applications and Systems',
      description: `Summarize representative systems and application settings for ${topic}.`,
      searchQueries: [`${topic} applications`, `${topic} system`, `${topic} deployment`],
      targetWordCount: DEPTH_WORD_COUNT[depth] || DEPTH_WORD_COUNT.standard,
      focusFacets: ['system', 'workflow', 'application']
    },
    {
      id: 'open-challenges',
      title: 'Open Challenges and Future Directions',
      description: `Identify limitations, open challenges, and future directions for ${topic}.`,
      searchQueries: [`${topic} limitations`, `${topic} challenges`, `${topic} future directions`],
      targetWordCount: DEPTH_WORD_COUNT[depth] || DEPTH_WORD_COUNT.standard,
      focusFacets: ['limitations', 'challenges', 'future directions']
    }
  ];

  const selectedSections = baseSections.slice(0, sectionCount).map((section, index) => ({
    ...section,
    id: `${slugify(section.id || section.title)}-${index + 1}`
  }));
  const topicProfile = buildFallbackTopicProfile(topic, selectedSections);
  const sections = selectedSections.map((section) => normalizeSection(section, section, topic, topicProfile));

  return {
    title: `A Survey of ${topic}`,
    abstractDraft: `This survey reviews ${topic} by organizing representative literature into a concise taxonomy, summarizing core methods, evaluation practices, and open research challenges.`,
    taxonomy: seedPapers.length > 0
      ? seedPapers.slice(0, Math.min(3, seedPapers.length)).map((paper) => paper.title)
      : ['Problem Setting', 'Methods', 'Evaluation'],
    sections,
    topicProfile
  };
}

function normalizeOutline(
  parsed: Partial<SurveyOutline> | null,
  fallback: SurveyOutline,
  topic: string,
  depth: string
): SurveyOutline {
  if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    return fallback;
  }

  const sectionCount = DEPTH_SECTION_COUNT[depth] || DEPTH_SECTION_COUNT.standard;
  const topicProfile = normalizeTopicProfile((parsed as any).topicProfile, fallback.topicProfile, topic, fallback.sections);
  const sections = parsed.sections.slice(0, sectionCount).map((section, index) => normalizeSection({
    id: slugify(section?.id || section?.title || `section-${index + 1}`),
    title: section?.title?.trim() || fallback.sections[index]?.title || `Section ${index + 1}`,
    description: section?.description?.trim() || fallback.sections[index]?.description || `Discuss ${topic}.`,
    searchQueries: Array.isArray(section?.searchQueries) && section.searchQueries.length > 0
      ? section.searchQueries.map((query) => String(query).trim()).filter(Boolean)
      : fallback.sections[index]?.searchQueries || [topic],
    targetWordCount: Number(section?.targetWordCount) > 0
      ? Number(section?.targetWordCount)
      : fallback.sections[index]?.targetWordCount || 220,
    focusFacets: Array.isArray((section as any)?.focusFacets) && (section as any).focusFacets.length > 0
      ? (section as any).focusFacets.map((facet: unknown) => String(facet).trim()).filter(Boolean)
      : fallback.sections[index]?.focusFacets || deriveSectionFacets(section?.title || fallback.sections[index]?.title || '')
  }, fallback.sections[index], topic, topicProfile));

  // Ensure canonical keywords are present; pad with fallback sections if needed
  const ensuredSections = ensureCanonicalSections(sections, fallback.sections, sectionCount, topic, topicProfile);

  return {
    title: parsed.title?.trim() || fallback.title,
    abstractDraft: parsed.abstractDraft?.trim() || fallback.abstractDraft,
    taxonomy: Array.isArray(parsed.taxonomy) && parsed.taxonomy.length > 0
      ? parsed.taxonomy.map((item) => String(item).trim()).filter(Boolean)
      : fallback.taxonomy,
    sections: ensuredSections,
    topicProfile
  };
}

const CANONICAL_KEYWORDS = ['background', 'methods', 'evaluation', 'applications', 'challenges'];

function sectionHasCanonical(title: string): boolean {
  const lower = title.toLowerCase();
  return CANONICAL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Ensure all sections contain a canonical keyword in their title.
 * If the LLM used a non-standard title, try to map it to the closest canonical keyword.
 * If sections are fewer than target, pad with fallback sections.
 */
function ensureCanonicalSections(
  sections: OutlineSection[],
  fallbackSections: OutlineSection[],
  targetCount: number,
  topic: string,
  topicProfile: TopicProfile
): OutlineSection[] {
  // Track which canonical keywords are already covered
  const covered = new Set<string>();
  for (const section of sections) {
    const lower = section.title.toLowerCase();
    for (const kw of CANONICAL_KEYWORDS) {
      if (lower.includes(kw)) covered.add(kw);
    }
  }

  // For sections without a canonical keyword, try to infer and rename
  const TITLE_HINTS: Record<string, string[]> = {
    background: ['landscape', 'scope', 'overview', 'introduction', 'foundation', 'context', 'setting'],
    methods: ['architecture', 'methodology', 'approach', 'framework', 'technique', 'model'],
    evaluation: ['benchmark', 'metric', 'performance', 'assessment', 'comparison', 'experiment'],
    applications: ['system', 'deployment', 'platform', 'tool', 'workflow', 'use case', 'real-world'],
    challenges: ['limitation', 'future', 'direction', 'open problem', 'gap', 'obstacle']
  };

  const result = sections.map((section) => {
    if (sectionHasCanonical(section.title)) return section;

    const lower = section.title.toLowerCase();
    for (const [kw, hints] of Object.entries(TITLE_HINTS)) {
      if (!covered.has(kw) && hints.some((h) => lower.includes(h))) {
        covered.add(kw);
        const canonical = kw.charAt(0).toUpperCase() + kw.slice(1);
        return { ...section, title: `${canonical}: ${section.title}` };
      }
    }
    return section;
  });

  // Pad with missing canonical sections from fallback
  if (result.length < targetCount) {
    const missing = CANONICAL_KEYWORDS.filter((kw) => !covered.has(kw));
    for (const kw of missing) {
      if (result.length >= targetCount) break;
      const fb = fallbackSections.find((s) => s.title.toLowerCase().includes(kw));
      if (fb) {
        result.push(normalizeSection({ ...fb }, fb, topic, topicProfile));
        covered.add(kw);
      }
    }
  }

  return result;
}

function normalizeTopicProfile(
  parsed: Partial<TopicProfile> | undefined,
  fallback: TopicProfile | undefined,
  topic: string,
  fallbackSections: OutlineSection[]
): TopicProfile {
  const base = fallback || buildFallbackTopicProfile(topic, fallbackSections);
  const anchorTerms = normalizeUniqueTerms(parsed?.anchorTerms, base.anchorTerms);
  const aliasPhrases = normalizeUniqueStrings(parsed?.aliasPhrases, base.aliasPhrases);
  const intentFacets = normalizeUniqueStrings(parsed?.intentFacets, base.intentFacets);
  const preferredPaperTypes = normalizeUniqueStrings(parsed?.preferredPaperTypes, base.preferredPaperTypes);
  const sectionFacets = { ...base.sectionFacets };

  if (parsed?.sectionFacets && typeof parsed.sectionFacets === 'object') {
    for (const [sectionId, facets] of Object.entries(parsed.sectionFacets)) {
      sectionFacets[sectionId] = normalizeUniqueStrings(facets, sectionFacets[sectionId] || []);
    }
  }

  return {
    originalTopic: topic,
    normalizedTopic: normalizeTopic(topic),
    anchorTerms,
    aliasPhrases,
    intentFacets,
    preferredPaperTypes,
    sectionFacets
  };
}

function normalizeSection(
  section: OutlineSection,
  fallbackSection: OutlineSection | undefined,
  topic: string,
  topicProfile: TopicProfile
): OutlineSection {
  const normalizedSection: OutlineSection = {
    ...section,
    focusFacets: normalizeUniqueStrings(section.focusFacets, fallbackSection?.focusFacets || deriveSectionFacets(section.title))
  };
  const queryPlan = buildQueryPlan(topic, topicProfile, normalizedSection);

  return {
    ...normalizedSection,
    searchQueries: queryPlan.map((item) => item.query),
    queryPlan
  };
}

function buildFallbackTopicProfile(topic: string, sections: OutlineSection[]): TopicProfile {
  const normalizedTopic = normalizeTopic(topic);
  const anchorTerms = tokenizeTopic(topic).slice(0, 5);
  const aliasPhrases = inferAliasPhrases(topic, anchorTerms);
  const sectionFacets = Object.fromEntries(
    sections.map((section) => [section.id, normalizeUniqueStrings(section.focusFacets, deriveSectionFacets(section.title))])
  );

  return {
    originalTopic: topic,
    normalizedTopic,
    anchorTerms,
    aliasPhrases,
    intentFacets: DEFAULT_INTENT_FACETS,
    preferredPaperTypes: DEFAULT_PAPER_TYPES,
    sectionFacets
  };
}

function buildQueryPlan(topic: string, topicProfile: TopicProfile, section: OutlineSection): ExpandedQuery[] {
  const plan: ExpandedQuery[] = [];
  const focusFacets = normalizeUniqueStrings(section.focusFacets, topicProfile.sectionFacets[section.id] || []);
  const leadAlias = topicProfile.aliasPhrases
    .filter((alias) => normalizeTopic(alias) !== topicProfile.normalizedTopic)
    .slice(0, 3);

  pushQuery(plan, topic, 'core', 1, 'base');
  pushQuery(plan, `${topic} ${section.title}`, 'section', 0.98, 'section');
  pushQuery(plan, `${topic} ${section.description}`, 'section', 0.58, 'section');

  for (const query of section.searchQueries || []) {
    pushQuery(plan, query, 'base', 0.95, 'base');
  }

  for (const alias of leadAlias) {
    pushQuery(plan, alias, 'alias', 0.72, 'alias');
    pushQuery(plan, `${alias} ${section.title}`, 'alias', 0.76, 'alias');
  }

  for (const facet of focusFacets.slice(0, 3)) {
    pushQuery(plan, `${topic} ${facet}`, facet, 0.9, 'facet');
    for (const alias of leadAlias.slice(0, 2)) {
      pushQuery(plan, `${alias} ${facet}`, facet, 0.91, 'facet');
    }
  }

  // Only add fallback queries for facets not already covered by the section's focus
  const coveredFacets = new Set(focusFacets.map((f) => f.toLowerCase()));
  const fallbackCandidates: Array<[string, string]> = [
    ['survey', `${topic} survey`],
    ['benchmark', `${topic} benchmark`],
    ['system', `${topic} system`]
  ];
  for (const [facet, query] of fallbackCandidates) {
    if (!coveredFacets.has(facet)) {
      pushQuery(plan, query, 'fallback', 0.55, 'fallback');
    }
  }

  return plan
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_SECTION_QUERIES);
}

function pushQuery(
  plan: ExpandedQuery[],
  rawQuery: string,
  facet: string,
  weight: number,
  source: ExpandedQuery['source']
): void {
  const query = rawQuery.replace(/\s+/g, ' ').trim();
  if (!query) return;

  const key = normalizeQueryKey(query);
  const existing = plan.find((item) => normalizeQueryKey(item.query) === key);
  if (existing) {
    existing.weight = Math.max(existing.weight, weight);
    return;
  }

  plan.push({ query, facet, weight, source });
}

/** Normalize a query for dedup: lowercase, singularize, drop stopwords, sort tokens */
function normalizeQueryKey(query: string): string {
  const stopwords = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'using', 'of', 'in', 'on', 'a', 'an']);
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((t) => singularize(t))
    .filter((t) => t.length > 1 && !stopwords.has(t))
    .sort()
    .join(' ');
}

function inferAliasPhrases(topic: string, anchorTerms: string[]): string[] {
  const aliases = [topic];
  const hasAi = anchorTerms.includes('ai') || anchorTerms.includes('artificial') || anchorTerms.includes('intelligence');
  const hasAgent = anchorTerms.includes('agent') || anchorTerms.includes('agents');
  const hasScientific = anchorTerms.includes('scientific') || anchorTerms.includes('science');
  const hasResearch = anchorTerms.includes('research') || anchorTerms.includes('discovery');

  if (hasAi && hasAgent && (hasScientific || hasResearch)) {
    aliases.push(
      'AI scientist',
      'autonomous scientific discovery',
      'scientific discovery agent',
      'research workflow agent',
      'multi-agent scientific discovery',
      'scientific research system'
    );
  } else if (hasAgent) {
    aliases.push(
      `${topic} framework`,
      `${topic} workflow`,
      `${topic} system`
    );
  } else {
    aliases.push(
      `${topic} survey`,
      `${topic} benchmark`,
      `${topic} system`
    );
  }

  return normalizeUniqueStrings(aliases, []);
}

function deriveSectionFacets(title: string): string[] {
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes('background') || normalizedTitle.includes('scope')) {
    return ['survey', 'review', 'overview'];
  }
  if (normalizedTitle.includes('method')) {
    return ['methods', 'framework', 'architecture'];
  }
  if (normalizedTitle.includes('evaluation') || normalizedTitle.includes('benchmark')) {
    return ['benchmark', 'evaluation', 'dataset'];
  }
  if (normalizedTitle.includes('application') || normalizedTitle.includes('system')) {
    return ['system', 'workflow', 'application'];
  }
  if (normalizedTitle.includes('challenge') || normalizedTitle.includes('future')) {
    return ['limitations', 'challenges', 'future directions'];
  }

  return ['survey', 'system', 'evaluation'];
}

function normalizeUniqueStrings(values: unknown, fallback: string[]): string[] {
  const input = Array.isArray(values) ? values : fallback;
  return Array.from(new Set(
    input
      .map((item) => String(item).trim())
      .filter(Boolean)
  ));
}

function normalizeUniqueTerms(values: unknown, fallback: string[]): string[] {
  const raw = normalizeUniqueStrings(values, fallback);
  return Array.from(new Set(raw.map((value) => singularize(normalizeTopic(value))).filter(Boolean)));
}

function tokenizeTopic(topic: string): string[] {
  const stopwords = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'using', 'study', 'based']);
  return Array.from(new Set(
    normalizeTopic(topic)
      .split(' ')
      .map((token) => singularize(token))
      .filter((token) => token.length > 1 && !stopwords.has(token))
  ));
}

function singularize(token: string): string {
  return token.endsWith('s') && token.length > 4 ? token.slice(0, -1) : token;
}

function normalizeTopic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ── Iterative Outline Refinement ──────────────────────────────────────

/**
 * Refine an outline based on actual retrieval results.
 * - Drop sections with zero papers
 * - Merge sections whose papers overlap heavily
 * - Discover new facets from paper clusters not covered by existing sections
 * Returns an updated outline (or the original if no refinement needed).
 */
export async function refineOutline(
  context: SkillContext,
  topic: string,
  outline: SurveyOutline,
  papersBySection: Record<string, Paper[]>,
  depth: string
): Promise<SurveyOutline> {
  const sectionCount = DEPTH_SECTION_COUNT[depth] || DEPTH_SECTION_COUNT.standard;

  // Build a retrieval summary for the LLM
  const sectionSummaries = outline.sections.map((section) => {
    const papers = papersBySection[section.id] || [];
    const paperList = papers.slice(0, 4).map((p) => `"${p.title}" (${p.year})`).join(', ');
    return `- "${section.title}" (id: ${section.id}): ${papers.length} papers found. ${paperList || 'No papers.'}`;
  }).join('\n');

  const allPaperTitles = Array.from(new Set(
    Object.values(papersBySection).flat().map((p) => p.title)
  ));

  const prompt = `
[OUTLINE_REFINEMENT]
Topic: "${topic}"
Current outline has ${outline.sections.length} sections. Target: ${sectionCount} sections.

Retrieval results per section:
${sectionSummaries}

Total unique papers found: ${allPaperTitles.length}

Based on these retrieval results, decide whether to refine the outline:
1. If a section found 0 papers, either drop it or merge it into another section.
2. If two sections retrieved mostly the same papers, merge them.
3. If papers reveal an important subtopic not covered by any section, add a new section.
4. Keep the total number of sections at ${sectionCount}.
5. Do NOT rename sections that are working well.
6. All section titles MUST contain one of: "Background", "Methods", "Evaluation", "Applications", "Challenges".

If no changes are needed, return {"refined": false}.
Otherwise, return:
{
  "refined": true,
  "sections": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "focusFacets": ["string"],
      "searchQueries": ["string"],
      "targetWordCount": 200
    }
  ],
  "changes": ["string describing each change made"]
}

Return ONLY valid JSON.
`;

  const response = await context.llm.chat([
    { role: 'system', content: 'You refine academic survey outlines based on retrieval evidence.' },
    { role: 'user', content: prompt }
  ]);

  const parsed = parseJsonObject<{
    refined?: boolean;
    sections?: Partial<OutlineSection>[];
    changes?: string[];
  }>(response.content);

  if (!parsed?.refined || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    return outline;
  }

  // Rebuild sections from refinement, preserving topicProfile
  const refinedSections = parsed.sections.slice(0, sectionCount).map((section, index) => {
    const existing = outline.sections.find((s) => s.id === section.id);
    return normalizeSection({
      id: slugify(section.id || section.title || `section-${index + 1}`),
      title: section.title?.trim() || existing?.title || `Section ${index + 1}`,
      description: section.description?.trim() || existing?.description || `Discuss ${topic}.`,
      searchQueries: Array.isArray(section.searchQueries) && section.searchQueries.length > 0
        ? section.searchQueries.map((q) => String(q).trim()).filter(Boolean)
        : existing?.searchQueries || [topic],
      targetWordCount: Number(section.targetWordCount) > 0
        ? Number(section.targetWordCount)
        : existing?.targetWordCount || 200,
      focusFacets: Array.isArray(section.focusFacets) && section.focusFacets.length > 0
        ? section.focusFacets.map((f) => String(f).trim()).filter(Boolean)
        : existing?.focusFacets || deriveSectionFacets(section.title || '')
    }, existing, topic, outline.topicProfile!);
  });

  return {
    ...outline,
    sections: refinedSections
  };
}
