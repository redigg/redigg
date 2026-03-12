import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { OutlineSection, TopicProfile } from './types.js';

const BROAD_ANCHOR_TERMS = new Set([
  'research',
  'scientific',
  'science',
  'study',
  'studies',
  'application',
  'applications',
  'domain',
  'domains'
]);

const PAPER_TYPE_PATTERNS: Record<string, RegExp> = {
  survey: /\b(survey|review|overview|perspective)\b/i,
  benchmark: /\b(benchmark|benchmarking|leaderboard|dataset|metric|evaluation)\b/i,
  system: /\b(system|platform|framework|pipeline|workflow|orchestration)\b/i,
  workflow: /\b(workflow|pipeline|orchestration|agentic)\b/i,
  evaluation: /\b(evaluation|benchmark|metric|ablation)\b/i,
  methods: /\b(method|approach|architecture|planning|reasoning|tool use)\b/i,
  application: /\b(application|deployment|case study|real world)\b/i,
  challenges: /\b(challenge|limitation|future direction|open problem|ethic|reliability)\b/i
};

export interface AnchorAssessment {
  anchorCoverage: number;
  technicalAnchorCoverage: number;
  aliasMatches: string[];
  facetMatches: string[];
  paperTypeSignals: string[];
  tier: 'strong' | 'weak' | 'off-topic';
  score: number;
}

export function parseJsonObject<T>(content: string): T | null {
  try {
    const trimmed = content.trim();
    if (!trimmed) return null;

    const withoutFence = trimmed.startsWith('```')
      ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
      : trimmed;

    const match = withoutFence.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const jsonStr = match ? match[0] : withoutFence;
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

export function normalizeText(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'section';
}

export function dedupePapers(papers: Paper[]): Paper[] {
  const seenById = new Map<string, Paper>();

  for (const paper of papers) {
    const key = buildPaperKey(paper);
    const existing = seenById.get(key);
    seenById.set(key, existing ? mergePaperRecords(existing, paper) : paper);
  }

  const seenByTitle = new Map<string, Paper>();
  for (const paper of seenById.values()) {
    const normalizedTitle = paper.title.toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim();
    const titleKey = paper.year ? `${normalizedTitle}:${paper.year}` : normalizedTitle;
    const existing = seenByTitle.get(titleKey);
    if (!existing) {
      seenByTitle.set(titleKey, paper);
      continue;
    }

    const yearsComparable = !existing.year || !paper.year || Math.abs(existing.year - paper.year) <= 1;
    if (!yearsComparable) {
      const fallbackKey = `${normalizedTitle}:${paper.year || 'unknown'}:${paper.source || 'unknown'}`;
      seenByTitle.set(fallbackKey, paper);
      continue;
    }

    seenByTitle.set(titleKey, mergePaperRecords(existing, paper));
  }

  return Array.from(seenByTitle.values());
}

export function buildPaperKey(paper: Paper): string {
  const doi = normalizeDoi(paper.doi || paper.externalIds?.DOI);
  if (doi) return `doi:${doi}`;

  const arxivId = paper.externalIds?.ArXiv || extractArxivId(paper.url || paper.pdfUrl);
  if (arxivId) return `arxiv:${arxivId.toLowerCase()}`;

  return `title:${paper.title.toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim()}`;
}

export function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function scorePaperForSection(paper: Paper, keywords: string[]): number {
  const haystack = `${paper.title} ${paper.summary}`.toLowerCase();
  const score = keywords.reduce((acc, keyword) => {
    if (!keyword) return acc;
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = haystack.match(new RegExp(escaped, 'g'));
    return acc + (matches?.length || 0);
  }, 0);

  return score
    + (paper.year || 0) / 10000
    + Math.min(Math.log10((paper.citationCount || 0) + 1), 2)
    + sourceQualityBonus(paper.source);
}

export function assessPaperAnchors(
  paper: Paper,
  topicProfile: TopicProfile | undefined,
  section: OutlineSection
): AnchorAssessment {
  const focusFacets = normalizeFacetTerms([
    ...(section.focusFacets || []),
    ...((topicProfile?.sectionFacets?.[section.id]) || []),
    ...(topicProfile?.intentFacets || []),
    ...(topicProfile?.preferredPaperTypes || [])
  ]);
  const text = normalizeMatchText([
    paper.title,
    paper.summary,
    paper.journal,
    ...(paper.authors || [])
  ].filter(Boolean).join(' '));
  const tokens = new Set(tokenizeForMatch(text));
  const anchors = normalizeAnchorTerms(topicProfile?.anchorTerms || []);
  const technicalAnchors = anchors.filter((anchor) => !BROAD_ANCHOR_TERMS.has(anchor));
  const aliasMatches = (topicProfile?.aliasPhrases || []).filter((alias) => {
    const normalizedAlias = normalizeMatchText(alias);
    return normalizedAlias.length > 0 && text.includes(normalizedAlias);
  });
  const anchorCoverage = anchors.filter((anchor) => tokens.has(anchor)).length;
  const technicalAnchorCoverage = technicalAnchors.filter((anchor) => tokens.has(anchor)).length;
  const facetMatches = focusFacets.filter((facet) => {
    const normalizedFacet = normalizeMatchText(facet);
    return normalizedFacet.length > 0 && text.includes(normalizedFacet);
  });
  const paperTypeSignals = detectPaperTypeSignals(text);
  const hasSupportiveSignal = facetMatches.length > 0 || paperTypeSignals.length > 0;

  let tier: AnchorAssessment['tier'] = 'off-topic';
  if (
    aliasMatches.length > 0 ||
    (technicalAnchorCoverage >= 1 && (anchorCoverage >= 2 || hasSupportiveSignal))
  ) {
    tier = 'strong';
  } else if (
    technicalAnchorCoverage >= 1 ||
    (anchorCoverage >= 2 && hasSupportiveSignal)
  ) {
    tier = 'weak';
  }

  return {
    anchorCoverage,
    technicalAnchorCoverage,
    aliasMatches,
    facetMatches,
    paperTypeSignals,
    tier,
    score:
      (aliasMatches.length > 0 ? 5 : 0) +
      technicalAnchorCoverage * 3 +
      anchorCoverage * 1.25 +
      facetMatches.length * 1.5 +
      paperTypeSignals.length * 0.75 +
      Math.min(Math.log10((paper.citationCount || 0) + 1), 2) +
      sourceQualityBonus(paper.source)
  };
}

export function filterPapersByAnchors(
  papers: Paper[],
  topicProfile: TopicProfile | undefined,
  section: OutlineSection,
  minimumKeep: number
): Paper[] {
  if (!topicProfile || papers.length === 0) {
    return papers;
  }

  const assessed = papers
    .map((paper) => ({ paper, assessment: assessPaperAnchors(paper, topicProfile, section) }))
    .sort((a, b) => b.assessment.score - a.assessment.score || (b.paper.year || 0) - (a.paper.year || 0));

  const strong = assessed.filter((item) => item.assessment.tier === 'strong');
  const weak = assessed.filter((item) => item.assessment.tier === 'weak');
  const retained = strong.length >= minimumKeep
    ? strong
    : [...strong, ...weak.slice(0, Math.max(0, minimumKeep - strong.length))];

  if (retained.length > 0) {
    return retained.map((item) => item.paper);
  }

  const fallback = weak.slice(0, minimumKeep).map((item) => item.paper);
  return fallback.length > 0 ? fallback : papers;
}

function mergePaperRecords(primary: Paper, secondary: Paper): Paper {
  const preferred = scorePaperRecord(secondary) > scorePaperRecord(primary) ? secondary : primary;
  const fallback = preferred === primary ? secondary : primary;
  const authors = Array.from(new Set([...(preferred.authors || []), ...(fallback.authors || [])]));
  const externalIds = { ...(fallback.externalIds || {}), ...(preferred.externalIds || {}) };

  return {
    ...fallback,
    ...preferred,
    authors,
    summary: pickLonger(preferred.summary, fallback.summary, 'No summary'),
    url: preferred.url || fallback.url,
    pdfUrl: preferred.pdfUrl || fallback.pdfUrl,
    journal: preferred.journal || fallback.journal,
    year: preferred.year || fallback.year,
    citationCount: Math.max(preferred.citationCount || 0, fallback.citationCount || 0),
    doi: normalizeDoi(preferred.doi || fallback.doi),
    externalIds: Object.keys(externalIds).length > 0 ? externalIds : undefined
  };
}

function normalizeAnchorTerms(terms: string[]): string[] {
  return Array.from(new Set(
    terms
      .map((term) => normalizeMatchText(term))
      .flatMap((term) => tokenizeForMatch(term))
      .filter((term) => term.length >= 2)
  ));
}

function normalizeFacetTerms(terms: string[]): string[] {
  return Array.from(new Set(
    terms
      .map((term) => normalizeMatchText(term))
      .filter((term) => term.length >= 3)
  ));
}

function detectPaperTypeSignals(text: string): string[] {
  return Object.entries(PAPER_TYPE_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([paperType]) => paperType);
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeForMatch(value: string): string[] {
  return normalizeMatchText(value)
    .split(' ')
    .filter((token) => token.length >= 2);
}

function scorePaperRecord(paper: Paper): number {
  return (paper.summary && paper.summary !== 'No summary' ? 4 : 0)
    + (paper.pdfUrl ? 2 : 0)
    + (paper.doi ? 1 : 0)
    + (paper.citationCount ? Math.min(Math.log10(paper.citationCount + 1), 3) : 0)
    + sourceQualityBonus(paper.source);
}

function sourceQualityBonus(source?: Paper['source']): number {
  switch (source) {
    case 'openalex':
      return 0.8;
    case 'semanticscholar':
      return 0.6;
    case 'arxiv':
      return 0.4;
    default:
      return 0;
  }
}

function pickLonger(primary?: string, fallback?: string, defaultValue: string = ''): string {
  const candidateA = primary?.trim() || '';
  const candidateB = fallback?.trim() || '';
  if (candidateA.length >= candidateB.length) {
    return candidateA || candidateB || defaultValue;
  }

  return candidateB || candidateA || defaultValue;
}

function normalizeDoi(doi?: string): string | undefined {
  if (!doi || typeof doi !== 'string') {
    return undefined;
  }

  return doi
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim()
    .toLowerCase() || undefined;
}

function extractArxivId(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/arxiv\.org\/(?:abs|pdf)\/([^?#/]+)|\/([^/?#]+)$/i);
  return (match?.[1] || match?.[2] || '').replace(/\.pdf$/i, '') || undefined;
}
