import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { ClaimAlignment, EvidenceCard, EvidenceLevel, OutlineSection, TopicProfile } from './types.js';

type SectionIntent = 'background' | 'methods' | 'evaluation' | 'applications' | 'challenges' | 'generic';

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

const FACET_TO_PAPER_TYPES: Record<string, string[]> = {
  survey: ['survey'],
  review: ['survey'],
  overview: ['survey'],
  perspective: ['survey'],
  benchmark: ['benchmark', 'evaluation'],
  benchmarking: ['benchmark', 'evaluation'],
  evaluation: ['benchmark', 'evaluation'],
  dataset: ['benchmark', 'evaluation'],
  metric: ['benchmark', 'evaluation'],
  leaderboard: ['benchmark', 'evaluation'],
  system: ['system'],
  platform: ['system'],
  framework: ['system', 'methods'],
  workflow: ['workflow', 'system'],
  pipeline: ['workflow', 'system'],
  orchestration: ['workflow', 'system'],
  methods: ['methods'],
  method: ['methods'],
  architecture: ['methods', 'system'],
  planning: ['methods', 'workflow'],
  reasoning: ['methods'],
  application: ['application', 'system'],
  applications: ['application', 'system'],
  deployment: ['application', 'system'],
  'case study': ['application'],
  limitations: ['challenges'],
  limitation: ['challenges'],
  challenges: ['challenges'],
  challenge: ['challenges'],
  ethics: ['challenges'],
  'future directions': ['challenges'],
  'future direction': ['challenges'],
  'open challenges': ['challenges'],
  'open problems': ['challenges']
};

const DOMAIN_SPECIFIC_TOKENS: Record<string, string[]> = {
  legal: ['legal', 'law', 'court', 'judicial', 'statute', 'litigation'],
  medical: ['medical', 'clinical', 'healthcare', 'patient', 'hospital', 'diagnosis', 'therapeutic'],
  finance: ['finance', 'financial', 'banking', 'trading', 'fintech', 'portfolio'],
  education: ['education', 'educational', 'student', 'classroom', 'pedagogy', 'tutoring'],
  chemistry: ['chemistry', 'chemical', 'molecule', 'molecular', 'synthesis', 'compound'],
  biology: ['biology', 'biological', 'genomic', 'genomics', 'biomedical', 'protein'],
  robotics: ['robot', 'robotic', 'manipulation', 'grasp', 'locomotion', 'navigation', 'slam'],
  agriculture: ['agriculture', 'agricultural', 'crop', 'farming', 'irrigation'],
  energy: ['energy', 'solar', 'wind', 'battery', 'grid', 'renewable'],
  manufacturing: ['manufacturing', 'assembly', 'quality control', 'defect detection'],
  climate: ['climate', 'weather', 'atmospheric', 'ocean', 'meteorological']
};

export interface AnchorAssessment {
  anchorCoverage: number;
  technicalAnchorCoverage: number;
  broadAnchorCoverage: number;
  titleAnchorCoverage: number;
  titleTechnicalAnchorCoverage: number;
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
  let text = content.replace(/\r\n/g, '\n').trim();
  // Remove markdown code fences sometimes emitted by LLMs
  text = text.replace(/^```(?:markdown)?\s*\n/gm, '').replace(/\n```\s*$/gm, '');
  // Remove common LLM preamble
  text = text.replace(/^(?:Here(?:'s| is) the (?:revised|improved|updated|rewritten) (?:section|version|content)[^\n]*\n+)/im, '');
  return text.trim();
}

export function stripManualHeadingNumbering(text: string): string {
  return text
    .replace(/^(?:section\s+)?(?:\d+(?:\.\d+){0,3}|[ivxlcdm]+(?:\.\d+){0,3})(?:[)\].:-])?\s+/i, '')
    .replace(/^(?:\([a-z]\)|[a-z]\))(?:[)\].:-])?\s+/i, '')
    .replace(/^(?:part|chapter)\s+\d+(?:[)\].:-])?\s+/i, '')
    .trim();
}

export function normalizeMarkdownHeadings(markdown: string): string {
  return markdown.replace(/^(#{2,4})\s+(.+)$/gm, (_match, hashes: string, rawTitle: string) => {
    const cleanedTitle = stripManualHeadingNumbering(rawTitle).replace(/\s+/g, ' ').trim();
    return `${hashes} ${cleanedTitle}`;
  });
}

export function stripCitationPlaceholders(markdown: string): string {
  return markdown
    .replace(/\[(?:N|TBD|\?+|citation needed|ref|refs?)\]/gi, '')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/ {2,}/g, ' ');
}

export function normalizeBibliographyVenue(paper: Paper): string {
  const rawVenue = (paper.journal || '').trim();
  const lowerVenue = rawVenue.toLowerCase();
  const hasArxivSignal = Boolean(
    paper.source === 'arxiv'
    || paper.url?.includes('arxiv.org')
    || paper.pdfUrl?.includes('arxiv.org')
    || /(?:^|\b)(arxiv|arxiv\.org|arxiv preprint|arxiv \(cornell university\)|cornell university)(?:\b|$)/i.test(rawVenue)
  );

  if (hasArxivSignal) {
    return 'arXiv preprint';
  }

  if (!rawVenue || lowerVenue === 'openalex' || lowerVenue === 'unknown venue') {
    return 'Preprint';
  }

  if (/\bpreprint\b/i.test(rawVenue)) {
    return 'Preprint';
  }

  return rawVenue.replace(/\s+/g, ' ').trim();
}

export function normalizeAuthorName(author: string): string {
  return author
    .replace(/Ã¤/g, 'ä').replace(/Ã¶/g, 'ö').replace(/Ã¼/g, 'ü')
    .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ã§/g, 'ç')
    .replace(/Ã±/g, 'ñ').replace(/Ã³/g, 'ó').replace(/Ã¡/g, 'á')
    .replace(/Ã­/g, 'í').replace(/Ãº/g, 'ú')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAuthorList(authors: string[]): string[] {
  return authors
    .map((author) => normalizeAuthorName(author))
    .filter(Boolean);
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

export function getQuotableFindings(card: Pick<EvidenceCard, 'quotableFindings'>): string[] {
  if (!Array.isArray(card.quotableFindings)) {
    return [];
  }
  return card.quotableFindings
    .map((finding) => String(finding).trim())
    .filter(Boolean);
}

export function normalizeNumericToken(token: string): string {
  return String(token || '').replace(/,/g, '').trim();
}

export function collectGroundedNumberTokens(cards: EvidenceCard[]): Set<string> {
  const groundedNumbers = new Set<string>();
  const evidenceText = cards
    .map((card) => [
      card.title,
      String(card.year || ''),
      card.keyContribution,
      card.groundedClaim,
      card.limitationHint,
      ...getQuotableFindings(card)
    ].join(' '))
    .join(' ');

  for (const match of evidenceText.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*%/g)) {
    groundedNumbers.add(normalizeNumericToken(match[1]));
  }
  for (const match of evidenceText.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*[×x]/gi)) {
    groundedNumbers.add(normalizeNumericToken(match[1]));
  }
  for (const match of evidenceText.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\b/g)) {
    groundedNumbers.add(normalizeNumericToken(match[1]));
  }

  return groundedNumbers;
}

function parseMarkdownTableCells(row: string): string[] {
  return row.trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function formatMarkdownTableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function isMarkdownTableRow(line: string): boolean {
  return /^\|.+\|/.test(line.trim());
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\|[\s:?-]+(\|[\s:?-]+)+\|?\s*$/.test(line.trim());
}

function rowCitationCards(row: string, evidenceCards: EvidenceCard[]): EvidenceCard[] {
  const citations = Array.from(row.matchAll(/\[(\d+)\]/g))
    .map((match) => Number(match[1]))
    .filter((citation) => Number.isFinite(citation));
  const cardsByCitation = new Map(evidenceCards.map((card) => [card.citation, card]));
  const matched = citations
    .map((citation) => cardsByCitation.get(citation))
    .filter((card): card is EvidenceCard => Boolean(card));
  return matched.length > 0 ? matched : evidenceCards;
}

function cellHasUnsupportedNumericClaim(cell: string, supportingCards: EvidenceCard[]): boolean {
  const plainCell = stripCitationPlaceholders(cell).replace(/\[\d+\]/g, '').trim();
  if (!plainCell) return false;
  if (!/\d/.test(plainCell)) return false;

  const groundedNumbers = collectGroundedNumberTokens(supportingCards);
  const supportedYears = new Set(supportingCards.map((card) => normalizeNumericToken(String(card.year))).filter(Boolean));
  const numericTokens = Array.from(plainCell.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\b/g))
    .map((match) => normalizeNumericToken(match[1]));
  if (numericTokens.length === 0) return false;

  return numericTokens.some((token) => {
    if (supportedYears.has(token)) {
      return false;
    }
    return !groundedNumbers.has(token);
  });
}

export function sanitizeMarkdownTables(markdown: string, evidenceCards: EvidenceCard[]): string {
  if (!markdown.includes('|') || evidenceCards.length === 0) {
    return markdown;
  }

  const lines = markdown.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!isMarkdownTableRow(lines[i])) {
      result.push(lines[i]);
      i++;
      continue;
    }

    const tableLines: string[] = [];
    while (i < lines.length && (isMarkdownTableRow(lines[i]) || (tableLines.length > 0 && isMarkdownTableSeparator(lines[i])))) {
      tableLines.push(lines[i]);
      i++;
    }

    if (tableLines.length < 3) {
      result.push(...tableLines);
      continue;
    }

    const normalizedTable = tableLines.map((line, idx) => {
      if (idx < 2) return line;
      if (!isMarkdownTableRow(line)) return line;

      const supportingCards = rowCitationCards(line, evidenceCards);
      const cells = parseMarkdownTableCells(line);
      const sanitizedCells = cells.map((cell) => cellHasUnsupportedNumericClaim(cell, supportingCards) ? 'N/A' : cell);
      return formatMarkdownTableRow(sanitizedCells);
    });

    result.push(...normalizedTable);
  }

  return result.join('\n');
}

export function scorePaperForSection(
  paper: Paper,
  keywords: string[],
  topicProfile?: TopicProfile,
  section?: OutlineSection
): number {
  const haystack = buildPaperMatchText(paper);
  const keywordScore = keywords.reduce((acc, keyword) => {
    if (!keyword) return acc;
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = haystack.match(new RegExp(escaped, 'g'));
    return acc + (matches?.length || 0);
  }, 0);

  let score = keywordScore
    + (paper.year || 0) / 10000
    + Math.min(Math.log10((paper.citationCount || 0) + 1), 2)
    + sourceQualityBonus(paper.source)
    + Math.min((paper.relevanceScore || 0) / 10, 3);

  if (topicProfile && section) {
    const assessment = assessPaperAnchors(paper, topicProfile, section);
    const preferredPaperTypes = inferPreferredPaperTypes(section, topicProfile);
    const paperTypeSignals = assessment.paperTypeSignals.length > 0
      ? assessment.paperTypeSignals
      : detectPaperTypeSignals(haystack);
    const preferredTypeMatches = paperTypeSignals.filter((signal) => preferredPaperTypes.has(signal));
    const supportiveTypeMatches = paperTypeSignals.filter((signal) => topicProfile.preferredPaperTypes.includes(signal));
    const tierBonus = assessment.tier === 'strong' ? 4 : assessment.tier === 'weak' ? 1.5 : -2.5;
    const mismatchPenalty = preferredPaperTypes.size > 0 && paperTypeSignals.length > 0 && preferredTypeMatches.length === 0
      ? -2.25
      : 0;

    score += assessment.anchorCoverage * 1.35;
    score += assessment.technicalAnchorCoverage * 2.6;
    score += assessment.aliasMatches.length * 3.1;
    score += assessment.facetMatches.length * 2.4;
    score += preferredTypeMatches.length * 4.5;
    score += supportiveTypeMatches.length * 0.8;
    score += tierBonus;
    score += mismatchPenalty;
    score += computeSectionPurityAdjustment(
      paper,
      haystack,
      section,
      topicProfile,
      assessment,
      paperTypeSignals,
      preferredPaperTypes
    );
  }

  return Number(score.toFixed(3));
}

export function assessPaperAnchors(
  paper: Paper,
  topicProfile: TopicProfile | undefined,
  section: OutlineSection
): AnchorAssessment {
  const focusFacets = normalizeFacetTerms([
    ...(section.focusFacets || []),
    ...((topicProfile?.sectionFacets?.[section.id]) || [])
  ]);
  const text = buildPaperMatchText(paper);
  const tokens = new Set(tokenizeForMatch(text));
  const titleText = normalizeMatchText(paper.title || '');
  const titleTokens = new Set(tokenizeForMatch(titleText));
  const anchors = normalizeAnchorTerms(topicProfile?.anchorTerms || []);
  const technicalAnchors = anchors.filter((anchor) => !BROAD_ANCHOR_TERMS.has(anchor));
  const preferredPaperTypes = topicProfile ? inferPreferredPaperTypes(section, topicProfile) : new Set<string>();
  const aliasMatches = (topicProfile?.aliasPhrases || []).filter((alias) => {
    const normalizedAlias = normalizeMatchText(alias);
    return normalizedAlias.length > 0 && text.includes(normalizedAlias);
  });
  const anchorCoverage = anchors.filter((anchor) => tokens.has(anchor)).length;
  const technicalAnchorCoverage = technicalAnchors.filter((anchor) => tokens.has(anchor)).length;
  const broadAnchorCoverage = Math.max(0, anchorCoverage - technicalAnchorCoverage);
  const titleAnchorCoverage = anchors.filter((anchor) => titleTokens.has(anchor)).length;
  const titleTechnicalAnchorCoverage = technicalAnchors.filter((anchor) => titleTokens.has(anchor)).length;
  const facetMatches = focusFacets.filter((facet) => {
    const normalizedFacet = normalizeMatchText(facet);
    return normalizedFacet.length > 0 && text.includes(normalizedFacet);
  });
  const paperTypeSignals = detectPaperTypeSignals(text);
  const preferredTypeMatches = paperTypeSignals.filter((signal) => preferredPaperTypes.has(signal));
  const hasSupportiveSignal = facetMatches.length > 0 || preferredTypeMatches.length > 0;
  const hasTitleScopedMatch = titleTechnicalAnchorCoverage >= 1 || aliasMatches.length > 0;

  let tier: AnchorAssessment['tier'] = 'off-topic';
  if (aliasMatches.length > 0 || titleTechnicalAnchorCoverage >= 2 || (hasTitleScopedMatch && hasSupportiveSignal)) {
    tier = 'strong';
  } else if (hasTitleScopedMatch && hasSupportiveSignal) {
    // Require both a title-scoped technical anchor AND a supportive signal (facet or paper type match)
    tier = 'weak';
  } else if (hasTitleScopedMatch && technicalAnchorCoverage >= 2 && broadAnchorCoverage >= 1) {
    // Fallback weak: title match + multiple technical anchors in body + at least 1 broad anchor
    tier = 'weak';
  }

  return {
    anchorCoverage,
    technicalAnchorCoverage,
    broadAnchorCoverage,
    titleAnchorCoverage,
    titleTechnicalAnchorCoverage,
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
    .map((paper) => {
      const assessment = assessPaperAnchors(paper, topicProfile, section);
      const paperText = buildPaperMatchText(paper);
      const paperTypeSignals = assessment.paperTypeSignals.length > 0
        ? assessment.paperTypeSignals
        : detectPaperTypeSignals(paperText);
      const preferredPaperTypes = inferPreferredPaperTypes(section, topicProfile);
      const purityAdjustment = computeSectionPurityAdjustment(
        paper,
        paperText,
        section,
        topicProfile,
        assessment,
        paperTypeSignals,
        preferredPaperTypes
      );

      return {
        paper,
        assessment,
        purityAdjustedScore: assessment.score + purityAdjustment
      };
    })
    .sort((a, b) => b.purityAdjustedScore - a.purityAdjustedScore || (b.paper.year || 0) - (a.paper.year || 0));

  const strong = assessed.filter((item) => item.assessment.tier === 'strong');
  const weak = assessed.filter((item) => item.assessment.tier === 'weak');
  const retained = strong.length >= minimumKeep
    ? strong
    : [...strong, ...weak.slice(0, Math.max(0, minimumKeep - strong.length))];

  if (retained.length > 0) {
    return retained.map((item) => item.paper);
  }

  const fallback = weak.slice(0, minimumKeep).map((item) => item.paper);
  return fallback;
}

export function buildEvidenceCards(
  papers: Paper[],
  citations: number[],
  section: OutlineSection,
  topicProfile?: TopicProfile
): EvidenceCard[] {
  return papers.map((paper, index) => {
    const assessment = topicProfile ? assessPaperAnchors(paper, topicProfile, section) : null;
    const text = normalizeMatchText([paper.title, paper.summary].filter(Boolean).join(' '));
    const paperTypeSignals = assessment?.paperTypeSignals?.length
      ? assessment.paperTypeSignals
      : detectPaperTypeSignals(text);
    const evidenceFocus = Array.from(new Set([
      ...(assessment?.facetMatches || []),
      ...(section.focusFacets || []),
      ...paperTypeSignals
    ])).slice(0, 4);
    const summarySentences = splitIntoSentences(paper.summary);
    const keyContribution = pickSentence(
      summarySentences,
      ['benchmark', 'evaluation', 'system', 'workflow', 'framework', 'survey', 'method', 'agent', 'discovery']
    ) || summarySentences[0] || fallbackContribution(paper);
    const limitationHint = pickSentence(
      summarySentences,
      ['limit', 'challenge', 'future', 'open', 'reliability', 'bias', 'constraint']
    ) || fallbackLimitationHint(section, paperTypeSignals);
    const groundedClaim = buildGroundedClaim(paper, keyContribution, evidenceFocus);

    const evidenceLevel = classifyEvidenceLevel(paper, paperTypeSignals);
    const quotableFindings = extractQuotableFindings(paper);

    return {
      citation: citations[index] ?? index + 1,
      title: paper.title,
      year: paper.year,
      source: paper.source,
      paperTypeSignals,
      evidenceFocus,
      keyContribution,
      groundedClaim,
      limitationHint,
      evidenceLevel,
      quotableFindings
    };
  });
}

/**
 * A5: Classify the evidence level of a paper based on its type signals and content.
 * - empirical: contains experiments, results, benchmarks, ablations
 * - system: describes a system, platform, or tool
 * - review: survey, review, or overview paper
 * - perspective: opinion, commentary, position paper
 * - unknown: cannot determine
 */
function classifyEvidenceLevel(paper: Paper, paperTypeSignals: string[]): EvidenceLevel {
  const text = normalizeMatchText([paper.title, paper.summary].filter(Boolean).join(' '));

  if (paperTypeSignals.includes('survey') || /\b(survey|review|overview|systematic review|meta-analysis)\b/.test(text)) {
    return 'review';
  }
  if (/\b(perspective|opinion|commentary|position paper|editorial|viewpoint)\b/.test(text)) {
    return 'perspective';
  }
  if (/\b(experiment|ablation|result|evaluat|accuracy|f1|precision|recall|bleu|rouge|benchmark|dataset|leaderboard|outperform|baseline)\b/.test(text)) {
    return 'empirical';
  }
  if (paperTypeSignals.includes('system') || paperTypeSignals.includes('workflow') ||
      /\b(system|platform|framework|pipeline|tool|deployment|implementation)\b/.test(text)) {
    return 'system';
  }
  return 'unknown';
}

/**
 * A5: Extract quotable findings — factual statements that can be directly
 * attributed to this paper based on its abstract. Only includes sentences
 * containing quantitative results or concrete factual claims.
 */
function extractQuotableFindings(paper: Paper): string[] {
  const sentences = splitIntoSentences(paper.summary);
  const findings: string[] = [];

  for (const sentence of sentences) {
    // Keep sentences with numbers, percentages, comparisons, or concrete results
    if (/\d+(\.\d+)?(%|×|x\b|\s*point)/i.test(sentence) ||
        /\b(outperform|state-of-the-art|sota|surpass|exceed|achieve|improve|reduce)\b/i.test(sentence)) {
      findings.push(sentence.trim());
    }
  }

  return findings.slice(0, 3);
}

export function alignClaimsToEvidence(
  content: string,
  evidenceCards: EvidenceCard[],
  suggestedClaims?: Array<{ claim?: string; citations?: number[] }>
): ClaimAlignment[] {
  const evidenceByCitation = new Map(evidenceCards.map((card) => [card.citation, card]));
  const alignments = new Map<string, ClaimAlignment>();
  const normalizedContent = normalizeMatchText(content);

  const addAlignment = (claim: string, citations: number[]) => {
    const cleanedClaim = claim.replace(/\s+/g, ' ').trim();
    if (!cleanedClaim) return;

    const validCitations = Array.from(new Set(
      citations.filter((citation) => evidenceByCitation.has(citation))
    )).sort((a, b) => a - b);

    if (validCitations.length === 0) return;

    const key = normalizeMatchText(cleanedClaim);
    const existing = alignments.get(key);
    const mergedCitations = existing
      ? Array.from(new Set([...existing.citations, ...validCitations])).sort((a, b) => a - b)
      : validCitations;
    const evidenceTitles = mergedCitations
      .map((citation) => evidenceByCitation.get(citation)?.title)
      .filter((title): title is string => Boolean(title));

    alignments.set(key, {
      claim: cleanedClaim,
      citations: mergedCitations,
      evidenceTitles
    });
  };

  for (const item of suggestedClaims || []) {
    const claim = typeof item?.claim === 'string' ? item.claim : '';
    const citations = Array.isArray(item?.citations) ? item.citations.map(Number) : [];
    const normalizedClaim = normalizeMatchText(claim);
    if (!normalizedClaim || !normalizedContent.includes(normalizedClaim)) {
      continue;
    }
    addAlignment(claim, citations);
  }

  for (const item of extractClaimAlignmentsFromContent(content)) {
    addAlignment(item.claim, item.citations);
  }

  return Array.from(alignments.values());
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

function inferSectionIntent(section: OutlineSection): SectionIntent {
  const sectionTerms = normalizeFacetTerms([
    section.title,
    section.description,
    ...(section.focusFacets || [])
  ]).join(' ');

  if (sectionTerms.includes('background') || sectionTerms.includes('scope') || sectionTerms.includes('overview')) {
    return 'background';
  }
  if (sectionTerms.includes('method') || sectionTerms.includes('architecture') || sectionTerms.includes('approach')) {
    return 'methods';
  }
  if (sectionTerms.includes('evaluation') || sectionTerms.includes('benchmark') || sectionTerms.includes('dataset')) {
    return 'evaluation';
  }
  if (sectionTerms.includes('application') || sectionTerms.includes('system') || sectionTerms.includes('workflow') || sectionTerms.includes('deployment')) {
    return 'applications';
  }
  if (sectionTerms.includes('challenge') || sectionTerms.includes('limitation') || sectionTerms.includes('future')) {
    return 'challenges';
  }
  return 'generic';
}

function detectPaperTypeSignals(text: string): string[] {
  return Object.entries(PAPER_TYPE_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([paperType]) => paperType);
}

function inferPreferredPaperTypes(section: OutlineSection, topicProfile: TopicProfile): Set<string> {
  const sectionTerms = normalizeFacetTerms([
    section.title,
    section.description,
    ...(section.focusFacets || []),
    ...((topicProfile.sectionFacets?.[section.id]) || [])
  ]);
  const preferred = new Set<string>();

  for (const term of sectionTerms) {
    for (const [hint, paperTypes] of Object.entries(FACET_TO_PAPER_TYPES)) {
      if (term === hint || term.includes(hint) || hint.includes(term)) {
        for (const paperType of paperTypes) {
          preferred.add(paperType);
        }
      }
    }
  }

  if (preferred.size === 0) {
    for (const term of normalizeFacetTerms(topicProfile.preferredPaperTypes || [])) {
      for (const [hint, paperTypes] of Object.entries(FACET_TO_PAPER_TYPES)) {
        if (term === hint || term.includes(hint) || hint.includes(term)) {
          for (const paperType of paperTypes) {
            preferred.add(paperType);
          }
        }
      }
    }
  }

  return preferred;
}

/**
 * Safe section-aware rerank:
 * - boost papers that match the section's rhetorical intent
 * - gently demote foreign-domain application papers in non-application sections
 * The adjustment is bounded so anchor relevance still dominates final ranking.
 */
function computeSectionPurityAdjustment(
  paper: Paper,
  paperText: string,
  section: OutlineSection,
  topicProfile: TopicProfile,
  assessment: AnchorAssessment,
  paperTypeSignals: string[],
  preferredPaperTypes: Set<string>
): number {
  const sectionIntent = inferSectionIntent(section);
  const preferredTypeMatches = paperTypeSignals.filter((signal) => preferredPaperTypes.has(signal));
  const hasPreferredTypeMatch = preferredTypeMatches.length > 0;
  const hasSurveySignal = paperTypeSignals.includes('survey');
  const hasBenchmarkSignal = paperTypeSignals.includes('benchmark') || paperTypeSignals.includes('evaluation');
  const hasMethodSignal = paperTypeSignals.includes('methods') || paperTypeSignals.includes('workflow') || paperTypeSignals.includes('system');
  const hasApplicationSignal = paperTypeSignals.includes('application');
  const hasChallengeSignal = paperTypeSignals.includes('challenges');
  const foreignDomains = detectForeignDomains(paperText, topicProfile);
  const hasExplicitMethodCue = /\b(method|approach|architecture|framework|planning|search|algorithm|inference|decoding)\b/i.test(paperText);

  let adjustment = 0;

  if (sectionIntent === 'background') {
    if (hasSurveySignal) adjustment += 3.2;
    if (hasBenchmarkSignal) adjustment += 0.8;
    if (!hasSurveySignal && hasApplicationSignal && !hasPreferredTypeMatch) adjustment -= 2.8;
    if (!hasSurveySignal && hasMethodSignal && !hasBenchmarkSignal) adjustment -= 0.9;
  } else if (sectionIntent === 'methods') {
    if (hasMethodSignal) adjustment += 2.6;
    if (hasExplicitMethodCue) adjustment += 1.2;
    if (hasSurveySignal) adjustment += 0.6;
    if (hasApplicationSignal && !hasMethodSignal && !hasPreferredTypeMatch) adjustment -= 3.1;
    if (hasApplicationSignal && foreignDomains.length > 0 && !hasExplicitMethodCue) adjustment -= 2.6;
  } else if (sectionIntent === 'evaluation') {
    if (hasBenchmarkSignal) adjustment += 3;
    if (hasSurveySignal) adjustment += 0.7;
    if (hasApplicationSignal && !hasBenchmarkSignal && !hasPreferredTypeMatch) adjustment -= 2.4;
  } else if (sectionIntent === 'applications') {
    if (hasApplicationSignal || hasMethodSignal) adjustment += 2.2;
  } else if (sectionIntent === 'challenges') {
    if (hasChallengeSignal) adjustment += 2.6;
    if (hasSurveySignal) adjustment += 1;
    if (hasApplicationSignal && !hasChallengeSignal && !hasPreferredTypeMatch) adjustment -= 1.6;
  }

  // B6: Penalize foreign-domain application papers in non-application sections (stronger)
  if (sectionIntent !== 'applications' && hasApplicationSignal && foreignDomains.length > 0 && !hasPreferredTypeMatch) {
    adjustment -= Math.min(6, foreignDomains.length * 2.5);
  }

  // B6: Penalize foreign-domain method/system papers in any section (stronger)
  // (e.g., a robotics manipulation method paper in an "AI agent" survey)
  if (foreignDomains.length > 0 && (hasMethodSignal || paperTypeSignals.includes('system')) && !hasApplicationSignal && !hasPreferredTypeMatch) {
    adjustment -= Math.min(5, foreignDomains.length * 2.2);
  }

  // B6: Penalize ANY foreign-domain paper even without explicit application/method signal
  if (foreignDomains.length > 0 && !hasPreferredTypeMatch && assessment.tier !== 'strong') {
    adjustment -= Math.min(3, foreignDomains.length * 1.2);
  }

  if (assessment.aliasMatches.length > 0 && hasPreferredTypeMatch) {
    adjustment += 0.4;
  }

  return Number(adjustment.toFixed(3));
}

function extractClaimAlignmentsFromContent(content: string): Array<{ claim: string; citations: number[] }> {
  const alignments: Array<{ claim: string; citations: number[] }> = [];
  const normalized = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .join(' ');
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const citations = Array.from(sentence.matchAll(/\[(\d+)\]/g))
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value));

    if (citations.length === 0) continue;

    const claim = sentence.replace(/\s*\[(\d+)\]/g, '').replace(/\s+/g, ' ').trim();
    if (!claim) continue;

    alignments.push({
      claim,
      citations: Array.from(new Set(citations)).sort((a, b) => a - b)
    });
  }

  return alignments;
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitIntoSentences(content?: string): string[] {
  return (content || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickSentence(sentences: string[], keywords: string[]): string | null {
  for (const sentence of sentences) {
    const normalized = normalizeMatchText(sentence);
    if (keywords.some((keyword) => normalized.includes(normalizeMatchText(keyword)))) {
      return sentence;
    }
  }

  return null;
}

function tokenizeForMatch(value: string): string[] {
  return normalizeMatchText(value)
    .split(' ')
    .map(normalizeMatchToken)
    .filter((token) => token.length >= 2);
}

function normalizeMatchToken(token: string): string {
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith('s') && token.length > 4) {
    return token.slice(0, -1);
  }

  return token;
}

function detectForeignDomains(paperText: string, topicProfile: TopicProfile): string[] {
  const paperTokens = new Set(tokenizeForMatch(paperText));
  const topicTokens = new Set(tokenizeForMatch([
    topicProfile.originalTopic,
    topicProfile.normalizedTopic,
    ...(topicProfile.aliasPhrases || [])
  ].join(' ')));

  return Object.entries(DOMAIN_SPECIFIC_TOKENS)
    .filter(([, cues]) => cues.some((cue) => paperTokens.has(normalizeMatchToken(cue)) && !topicTokens.has(normalizeMatchToken(cue))))
    .map(([domain]) => domain);
}

function buildPaperMatchText(paper: Paper): string {
  const summarySnippet = (paper.summary || '').slice(0, 1200);
  return normalizeMatchText([
    paper.title,
    summarySnippet,
    paper.journal
  ].filter(Boolean).join(' '));
}

function fallbackContribution(paper: Paper): string {
  const sourceText = paper.summary && paper.summary !== 'No summary'
    ? paper.summary
    : `${paper.title} contributes representative evidence for this topic.`;
  return sourceText.replace(/\s+/g, ' ').trim();
}

function fallbackLimitationHint(section: OutlineSection, paperTypeSignals: string[]): string {
  if (paperTypeSignals.includes('benchmark') || paperTypeSignals.includes('evaluation')) {
    return `Further work is needed to test whether current ${section.title.toLowerCase()} practices transfer across tasks and domains.`;
  }

  if (paperTypeSignals.includes('system') || paperTypeSignals.includes('workflow')) {
    return `The literature still leaves open questions about robustness, orchestration cost, and deployment constraints for ${section.title.toLowerCase()}.`;
  }

  return `The literature still leaves unresolved questions about coverage, generalization, and evidence quality for ${section.title.toLowerCase()}.`;
}

function buildGroundedClaim(paper: Paper, keyContribution: string, evidenceFocus: string[]): string {
  const focus = evidenceFocus.length > 0 ? evidenceFocus.slice(0, 2).join(' and ') : 'the topic';
  return `${paper.title} provides evidence on ${focus}: ${keyContribution}`.replace(/\s+/g, ' ').trim();
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

export interface CitationConsistencyReport {
  /** Citation numbers used in text but outside valid reference range */
  ghostCitations: number[];
  /** Reference indices (1-based) that are never cited in text */
  orphanReferences: number[];
  /** All valid citation numbers found in text */
  usedCitations: number[];
  /** Total reference count */
  totalReferences: number;
  /** true when no ghosts and no orphans */
  isConsistent: boolean;
}

/**
 * Check bidirectional consistency between inline [n] citations in markdown
 * and the reference list (1-based, length = referenceCount).
 */
export function checkCitationConsistency(
  markdown: string,
  referenceCount: number
): CitationConsistencyReport {
  const cited = new Set(
    Array.from(markdown.matchAll(/\[(\d+)\]/g))
      .map((m) => Number(m[1]))
      .filter(Number.isFinite)
  );

  const validRange = new Set(
    Array.from({ length: referenceCount }, (_, i) => i + 1)
  );

  const ghostCitations = Array.from(cited)
    .filter((n) => !validRange.has(n))
    .sort((a, b) => a - b);

  const usedCitations = Array.from(cited)
    .filter((n) => validRange.has(n))
    .sort((a, b) => a - b);

  const orphanReferences = Array.from(validRange)
    .filter((n) => !cited.has(n))
    .sort((a, b) => a - b);

  return {
    ghostCitations,
    orphanReferences,
    usedCitations,
    totalReferences: referenceCount,
    isConsistent: ghostCitations.length === 0 && orphanReferences.length === 0
  };
}

/**
 * Strip ghost citation markers from markdown (citations outside valid range).
 * Preserves valid citations untouched.
 */
export function stripGhostCitations(markdown: string, referenceCount: number): string {
  // Handle multi-citation brackets like [14,15] or [3, 5, 14]
  let result = markdown.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (match, inner: string) => {
    const nums = inner.split(',').map((s) => Number(s.trim()));
    const valid = nums.filter((n) => n >= 1 && n <= referenceCount);
    if (valid.length === 0) return '';
    if (valid.length === nums.length) return match; // all valid, keep as-is
    return `[${valid.join(',')}]`;
  });
  return result.replace(/ {2,}/g, ' ');
}
