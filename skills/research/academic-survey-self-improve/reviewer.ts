import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyQualityReport } from './types.js';
import { getSectionWritingTemplate } from './section-templates.js';
import { alignClaimsToEvidence, collectGroundedNumberTokens, countWords, getQuotableFindings, normalizeText, parseJsonObject } from './utils.js';

interface ReviewResponse {
  score: number;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  needsRewrite?: boolean;
}

type HardCheckSeverity = 'critical' | 'major' | 'minor';

interface HardCheckResult {
  scorePenalty: number;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  forceRewrite: boolean;
  severity: HardCheckSeverity;
  fabricatedNumbers: string[];
  citationDistribution: { overCited: number[]; unCited: number[] };
}

interface CrossSectionFeedback {
  scorePenalty: number;
  issues: string[];
  suggestions: string[];
  forceRewrite: boolean;
}

export async function reviewSurveySections(
  context: SkillContext,
  topic: string,
  sections: SectionDraft[]
): Promise<{ sections: SectionDraft[]; qualityReport: SurveyQualityReport }> {
  const reviewedSections: SectionDraft[] = [];
  const sectionReviews: SurveyQualityReport['sectionReviews'] = [];

  for (const section of sections) {
    let finalReview = await evaluateSectionDraft(context, topic, section);
    let finalSection = section;
    let rewriteApplied = false;

    // Only rewrite on critical hard-check issues OR very low LLM review score
    if (finalReview.score < 60 || finalReview.needsRewrite) {
      const rewritten = await rewriteSection(context, topic, section, finalReview.suggestions);
      if (rewritten) {
        finalSection = {
          ...section,
          content: rewritten,
          claimAlignments: alignClaimsToEvidence(rewritten, section.evidenceCards, section.claimAlignments)
        };
        rewriteApplied = true;
        finalReview = await evaluateSectionDraft(context, topic, finalSection);
      }
    }

    reviewedSections.push(finalSection);
    sectionReviews.push({
      sectionId: section.sectionId,
      score: finalReview.score,
      strengths: finalReview.strengths,
      issues: finalReview.issues,
      suggestions: finalReview.suggestions,
      rewriteApplied
    });
  }

  const crossSectionFeedback = runCrossSectionChecks(reviewedSections);
  for (let i = 0; i < reviewedSections.length; i++) {
    const feedback = crossSectionFeedback.get(reviewedSections[i].sectionId);
    if (!feedback) continue;

    sectionReviews[i] = {
      ...sectionReviews[i],
      score: Math.max(0, sectionReviews[i].score - feedback.scorePenalty),
      issues: uniqueTop([...sectionReviews[i].issues, ...feedback.issues]),
      suggestions: uniqueTop([...sectionReviews[i].suggestions, ...feedback.suggestions])
    };

    if (feedback.forceRewrite) {
      const rewritten = await rewriteSection(context, topic, reviewedSections[i], sectionReviews[i].suggestions);
      if (rewritten) {
        reviewedSections[i] = {
          ...reviewedSections[i],
          content: rewritten,
          claimAlignments: alignClaimsToEvidence(rewritten, reviewedSections[i].evidenceCards, reviewedSections[i].claimAlignments)
        };
        const reevaluatedReview = await evaluateSectionDraft(context, topic, reviewedSections[i]);
        sectionReviews[i] = {
          sectionId: reviewedSections[i].sectionId,
          score: Math.max(0, reevaluatedReview.score - feedback.scorePenalty),
          strengths: reevaluatedReview.strengths,
          issues: uniqueTop([...reevaluatedReview.issues, ...feedback.issues]),
          suggestions: uniqueTop([...reevaluatedReview.suggestions, ...feedback.suggestions]),
          rewriteApplied: true
        };
      }
    }
  }

  // Use max(mean, median) to prevent a single low-scoring section from dragging overall quality gate
  const overallScore = sectionReviews.length > 0
    ? (() => {
        const scores = sectionReviews.map((item) => item.score).sort((a, b) => a - b);
        const mean = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        const mid = Math.floor(scores.length / 2);
        const median = scores.length % 2 === 0
          ? Math.round((scores[mid - 1] + scores[mid]) / 2)
          : scores[mid];
        return Math.max(mean, median);
      })()
    : 0;

  const strengths = Array.from(new Set(sectionReviews.flatMap((item) => item.strengths))).slice(0, 5);
  const issues = Array.from(new Set(sectionReviews.flatMap((item) => item.issues))).slice(0, 5);
  const suggestions = Array.from(new Set(sectionReviews.flatMap((item) => item.suggestions))).slice(0, 5);

  return {
    sections: reviewedSections,
    qualityReport: {
      overallScore,
      sectionReviews,
      strengths,
      issues,
      suggestions
    }
  };
}

async function evaluateSectionDraft(
  context: SkillContext,
  topic: string,
  section: SectionDraft
): Promise<ReviewResponse> {
  const review = await reviewSection(context, topic, section);
  const hardChecks = runHardChecks(section);
  return mergeReviewWithHardChecks(review, hardChecks);
}

// Cross-review roles: each reviews from a different perspective
const REVIEW_ROLES = [
  {
    system: 'You review academic survey sections for evidence grounding and citation accuracy.',
    focus: 'evidence grounding: Are all claims supported by the cited evidence cards? Are citations used correctly?'
  },
  {
    system: 'You review academic survey sections for synthesis quality and rhetorical structure.',
    focus: 'synthesis and structure: Does the section follow the rhetorical goal and required moves? Is it a true synthesis rather than a list of papers?'
  }
];

async function reviewSection(
  context: SkillContext,
  topic: string,
  section: SectionDraft
): Promise<ReviewResponse> {
  const template = getSectionWritingTemplate(section.templateKind);
  const evidenceSummary = section.evidenceCards
    .map((card) => `[${card.citation}] ${card.title} | focus: ${card.evidenceFocus.join(', ') || 'general'} | claim: ${card.groundedClaim}`)
    .join('\n');

  const basePrompt = `
[SURVEY_SECTION_REVIEW]
Topic: ${topic}

Section template: ${template.label} (${template.kind})
Rhetorical goal: ${template.rhetoricalGoal}
Required moves:
${template.requiredMoves.map((m) => `- ${m}`).join('\n')}
Anti-patterns to check for:
${template.antiPatterns.map((a) => `- ${a}`).join('\n')}
Expected closing move: ${template.closingMove}

Available evidence cards:
${evidenceSummary || 'No evidence cards available.'}

${section.content}`;

  // Run cross-reviews in parallel
  const reviewPromises = REVIEW_ROLES.map((role) => {
    const prompt = `${basePrompt}

Focus your review on: ${role.focus}

Return ONLY valid JSON:
{
  "score": 80,
  "strengths": ["string"],
  "issues": ["string"],
  "suggestions": ["string"],
  "needsRewrite": false
}
`;
    return context.llm.chat([
      { role: 'system', content: role.system },
      { role: 'user', content: prompt }
    ]).then((response) => {
      const parsed = parseJsonObject<Partial<ReviewResponse>>(response.content);
      return {
        score: Number(parsed?.score) > 0 ? Number(parsed?.score) : 80,
        strengths: Array.isArray(parsed?.strengths) && parsed!.strengths!.length > 0 ? parsed!.strengths!.map(String) : [],
        issues: Array.isArray(parsed?.issues) ? parsed!.issues!.map(String) : [],
        suggestions: Array.isArray(parsed?.suggestions) ? parsed!.suggestions!.map(String) : [],
        needsRewrite: Boolean(parsed?.needsRewrite)
      };
    }).catch(() => ({
      score: 75,
      strengths: [] as string[],
      issues: [] as string[],
      suggestions: [] as string[],
      needsRewrite: false
    }));
  });

  const reviews = await Promise.all(reviewPromises);

  // Merge cross-reviews: average scores, union strengths/issues/suggestions
  return mergeCrossReviews(reviews);
}

function mergeCrossReviews(reviews: ReviewResponse[]): ReviewResponse {
  if (reviews.length === 0) {
    return { score: 75, strengths: ['Grounded in retrieved papers'], issues: [], suggestions: [], needsRewrite: false };
  }

  const avgScore = Math.round(reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length);
  const allStrengths = reviews.flatMap((r) => r.strengths);
  const allIssues = reviews.flatMap((r) => r.issues);
  const allSuggestions = reviews.flatMap((r) => r.suggestions);
  const needsRewrite = reviews.some((r) => r.needsRewrite);

  return {
    score: avgScore,
    strengths: allStrengths.length > 0 ? uniqueTop(allStrengths) : ['Grounded in retrieved papers'],
    issues: uniqueTop(allIssues),
    suggestions: uniqueTop(allSuggestions),
    needsRewrite
  };
}

async function rewriteSection(
  context: SkillContext,
  topic: string,
  section: SectionDraft,
  suggestions: string[]
): Promise<string | null> {
  const template = getSectionWritingTemplate(section.templateKind);
  const evidenceSummary = section.evidenceCards
    .map((card) => {
      const quotables = getQuotableFindings(card);
      const quotableBlock = quotables.length > 0
        ? `\n- Verbatim-supported findings: ${quotables.join(' | ')}`
        : '';
      return `[${card.citation}] ${card.title}\n- Evidence level: ${card.evidenceLevel}\n- Grounded claim: ${card.groundedClaim}\n- Limitation hint: ${card.limitationHint}${quotableBlock}`;
    })
    .join('\n');
  const claimSummary = section.claimAlignments
    .map((item) => `- Claim: ${item.claim}\n  Citations: ${item.citations.join(', ')}`)
    .join('\n');
  const target = section.targetWordCount || 200;
  const subheadingGuidance = target >= 400
    ? `\nIMPORTANT: Use 2-3 sub-headings (### level) to organize content within this section. Each sub-heading should cover a distinct theme or method family.`
    : '';
  const prompt = `
[SURVEY_SECTION_REWRITE]
Topic: ${topic}
Section template: ${template.label} (${template.kind})
Rhetorical goal: ${template.rhetoricalGoal}
CRITICAL LENGTH REQUIREMENT: The current draft is ONLY ${countWords(section.content)} words but the target is ${target} words. You MUST write at least ${target} words, aim for ${Math.round(target * 1.15)} words. This means you need to ADD approximately ${Math.max(0, target - countWords(section.content))} words. Expand each paragraph to 80-150 words and add new paragraphs with deeper analysis, comparisons between methods, and discussion of tradeoffs.
Required moves:
${template.requiredMoves.map((m) => `- ${m}`).join('\n')}
Closing move: ${template.closingMove}
${subheadingGuidance}

Improve the following survey section using these suggestions:
${suggestions.join('\n') || 'Improve clarity and evidence grounding.'}

You must stay within the following evidence cards. NEVER fabricate specific numbers, percentages, or statistics not present in the evidence cards:
${evidenceSummary || 'No evidence cards available.'}

Current claim-to-citation alignments:
${claimSummary || 'No claim alignments available.'}

${section.content}

Return ONLY the revised Markdown section text. Do NOT include:
- A lead paragraph without citations; the first paragraph after the ## heading must already contain supporting citations
- Empirical verbs such as "demonstrates", "achieves", "outperforms", or "shows" for review/perspective evidence cards; use hedged verbs such as "argues", "suggests", or "reviews" instead
- Named benchmarks, systems, or quantitative claims that are not explicitly supported by the evidence cards
- Manual heading numbering such as "### 1.1 ..." or "### Section 3 ..."
- Any preamble like "Here's the revised section..."
- Any postamble like "This revision expands to X words with..."
- Any word count annotations like "(Word count: N)"
- Any numbered lists describing what you changed (e.g. "1. New subsections... 2. Deeper synthesis...")
- Any meta-commentary about the revision process
- Unsupported quantitative cells in tables; use "N/A" or qualitative text when the evidence cards do not provide an exact number
Output ONLY the academic survey text starting with ## heading.
`;

  const response = await context.llm.chat([
    { role: 'system', content: 'You revise academic survey sections without changing their scope. Output ONLY the revised section text — no preamble, no postamble, no meta-commentary.' },
    { role: 'user', content: prompt }
  ]);

  let content = normalizeText(response.content);
  if (!content) return null;

  // Strip LLM meta-commentary that may leak despite instructions
  content = stripLlmMetaCommentary(content);

  return content;
}

/**
 * Strip common LLM meta-commentary patterns from section content.
 * Applied both in reviewer (after rewrite) and assembler (as safety net).
 */
function stripLlmMetaCommentary(text: string): string {
  let cleaned = text;

  // Remove preamble lines
  cleaned = cleaned.replace(/^(?:Here(?:'s| is) (?:the |a |my )?(?:revised|improved|updated|rewritten|expanded|new)[^\n]*(?:section|version|content|draft|text)[^\n]*\n+)/gim, '');

  // Remove postamble self-evaluation blocks
  cleaned = cleaned.replace(/\n+(?:This (?:revision|revised|expanded|updated|rewritten)[^\n]*(?:expands?|incorporates?|improves?|includes?|adds?)[^\n]*(?:\n(?:\d+\.\s+[^\n]+))*)\s*$/gi, '');
  cleaned = cleaned.replace(/\n+(?:The revised (?:section|version)[^\n]*)\s*$/gi, '');

  // Remove "(Word count: N)" and standalone word count lines
  cleaned = cleaned.replace(/\s*\(Word count:\s*[\d,]+\)\s*/gi, ' ');
  cleaned = cleaned.replace(/^\s*Word count:\s*[\d,]+\s*$/gim, '');

  // Remove numbered meta-commentary lists at the end
  cleaned = cleaned.replace(/\n+(?:\d+\.\s+(?:New|Deeper|Enhanced|Improved|Added|Consolidated|Unified|Better|Clearer|Expanded|Strengthened)[^\n]+(?:\n\d+\.\s+(?:New|Deeper|Enhanced|Improved|Added|Consolidated|Unified|Better|Clearer|Expanded|Strengthened)[^\n]+)*)\s*$/gi, '');

  return cleaned.trim();
}

function runHardChecks(section: SectionDraft): HardCheckResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const strengths: string[] = [];
  let scorePenalty = 0;
  let criticalCount = 0;
  let majorCount = 0;

  const kind = section.templateKind;
  const wordCount = countWords(section.content);
  const citationMatches = Array.from(section.content.matchAll(/\[(\d+)\]/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const usedCitations = new Set(citationMatches);
  const availableCitations = new Set(section.evidenceCards.map((card) => card.citation));
  const paperTypeSignals = new Set(section.evidenceCards.flatMap((card) => card.paperTypeSignals));
  const claimAlignments = section.claimAlignments || [];

  // --- universal checks ---

  if (section.evidenceCards.length === 0) {
    issues.push('No evidence cards were attached to this section.');
    suggestions.push('Retrieve and attach grounded evidence cards before drafting this section.');
    scorePenalty += 25;
    criticalCount++;
  } else {
    strengths.push(`Grounded in ${section.evidenceCards.length} evidence cards`);
  }

  if (usedCitations.size === 0) {
    issues.push('The section does not cite any supporting evidence.');
    suggestions.push('Add inline citations that point back to the available evidence cards.');
    scorePenalty += 18;
    criticalCount++;
  } else if (section.evidenceCards.length > 1 && usedCitations.size < 2) {
    issues.push('The section relies on too few distinct evidence cards.');
    suggestions.push('Use at least two distinct citations when multiple evidence cards are available.');
    scorePenalty += 8;
    majorCount++;
  } else {
    strengths.push('Uses multiple evidence-backed citations');
  }

  const unknownCitations = Array.from(usedCitations).filter((citation) => !availableCitations.has(citation));
  if (unknownCitations.length > 0) {
    issues.push(`The section references citations not present in its evidence cards: ${unknownCitations.join(', ')}.`);
    suggestions.push('Align every inline citation with the evidence cards attached to this section.');
    // Graded: 1-2 unknown is minor, 3+ is major
    if (unknownCitations.length >= 3) {
      scorePenalty += 12;
      majorCount++;
    } else {
      scorePenalty += 5;
    }
  }

  if (claimAlignments.length === 0) {
    issues.push('The section does not expose claim-level citation alignment.');
    suggestions.push('Identify the core sentence-level claims in this section and map each of them to explicit evidence-card citations.');
    scorePenalty += 6;
    // minor — claim alignment is nice-to-have, not worth forcing rewrite
  } else {
    strengths.push(`Tracks ${claimAlignments.length} claim-level citation alignments`);
  }

  const invalidClaimMappings = claimAlignments.filter((item) =>
    item.citations.length === 0 || item.citations.some((citation) => !availableCitations.has(citation))
  );
  if (invalidClaimMappings.length > 0) {
    issues.push('Some claim-level citation mappings reference citations outside this section evidence set.');
    suggestions.push('Ensure every aligned claim only references citations from this section\u2019s evidence cards.');
    scorePenalty += 4;
    // minor — doesn't warrant full rewrite
  }

  if (wordCount < 80) {
    issues.push('The section is too short to provide a useful synthesis.');
    suggestions.push('Expand the section with a clearer synthesis of the retrieved evidence.');
    scorePenalty += 10;
    criticalCount++;
  }

  // Depth enforcement: check against targetWordCount
  const target = section.targetWordCount || 200;
  const minAcceptable = Math.round(target * 0.75);
  if (wordCount < minAcceptable && wordCount >= 80) {
    issues.push(`Section is ${wordCount} words but target is ${target} (minimum ${minAcceptable}).`);
    suggestions.push(`Expand the section to at least ${minAcceptable} words by deepening synthesis of the evidence cards. Add sub-headings (###) to organize longer content.`);
    scorePenalty += Math.min(15, Math.round((1 - wordCount / target) * 20));
    criticalCount++;
  } else if (wordCount >= minAcceptable) {
    strengths.push(`Word count ${wordCount} meets target ${target}`);
  }

  const leadParagraph = extractLeadParagraph(section.content);
  if (leadParagraph) {
    if (!/\[\d+\]/.test(leadParagraph) && section.evidenceCards.length > 0) {
      issues.push('The section lead paragraph introduces claims before citing any supporting evidence.');
      suggestions.push('Ground the first paragraph immediately with section-relevant citations instead of opening with unsupported framing claims.');
      scorePenalty += 8;
      majorCount++;
    }

    const leadFabricatedNumbers = detectFabricatedNumbers(section, leadParagraph);
    if (leadFabricatedNumbers.length > 0) {
      issues.push(`Unsupported quantitative claims appear in the section lead paragraph: ${leadFabricatedNumbers.slice(0, 3).join(', ')}`);
      suggestions.push('Remove unsupported numbers from the opening paragraph or replace them with qualitative synthesis grounded in the evidence cards.');
      scorePenalty += Math.min(12, leadFabricatedNumbers.length * 4);
      criticalCount++;
    }
  }

  const citationPlaceholders = detectCitationPlaceholders(section.content);
  if (citationPlaceholders.length > 0) {
    issues.push(`Citation placeholders remain in the section: ${citationPlaceholders.slice(0, 4).join(', ')}`);
    suggestions.push('Remove placeholder citations such as [N] and replace them with concrete evidence-card references.');
    scorePenalty += Math.min(10, citationPlaceholders.length * 3);
    majorCount++;
  }

  // --- Fabricated number detection ---
  const fabricatedNumbers = detectFabricatedNumbers(section);
  if (fabricatedNumbers.length > 0) {
    issues.push(`Potentially fabricated numbers detected: ${fabricatedNumbers.slice(0, 5).join(', ')}`);
    suggestions.push('Remove or replace fabricated numbers with qualitative descriptions. Only use numbers that appear verbatim in evidence cards.');
    scorePenalty += Math.min(15, fabricatedNumbers.length * 4);
    if (fabricatedNumbers.length >= 3) {
      criticalCount++;
    } else {
      majorCount++;
    }
  } else {
    strengths.push('No fabricated numbers detected');
  }

  const unsupportedTableCells = detectUnsupportedTableCells(section);
  if (unsupportedTableCells.length > 0) {
    issues.push(`Unsupported quantitative table cells detected: ${unsupportedTableCells.slice(0, 3).join('; ')}`);
    suggestions.push('Replace unsupported quantitative table entries with "N/A" or qualitative descriptions unless the exact value appears in the cited evidence card.');
    scorePenalty += Math.min(12, unsupportedTableCells.length * 3);
    if (unsupportedTableCells.length >= 2) {
      criticalCount++;
    } else {
      majorCount++;
    }
  }

  // --- Citation distribution check ---
  const citationDistribution = checkCitationDistribution(section, citationMatches, availableCitations);
  if (citationDistribution.overCited.length > 0) {
    issues.push(`Citation stacking detected: citations ${citationDistribution.overCited.join(', ')} appear excessively.`);
    suggestions.push('Distribute citations more evenly. Each citation should support specific claims, not be piled onto every sentence.');
    scorePenalty += Math.min(5, citationDistribution.overCited.length * 2);
  }
  if (citationDistribution.unCited.length > 0 && section.evidenceCards.length > 2) {
    issues.push(`Evidence cards ${citationDistribution.unCited.join(', ')} are available but never cited.`);
    suggestions.push('Incorporate unused evidence cards into the synthesis to improve coverage.');
    scorePenalty += Math.min(5, citationDistribution.unCited.length);
  }

  // --- A1: Evidence level misuse check ---
  const perspectiveCards = section.evidenceCards.filter((c) => c.evidenceLevel === 'perspective' || c.evidenceLevel === 'review');
  const perspectiveCitations = new Set(perspectiveCards.map((c) => c.citation));
  // Check if perspective/review papers are cited with empirical framing verbs
  const empiricalFramingPattern = /(?:demonstrate|show|prove|achieve|outperform|result|experiment|find that)\w*\s+[^.]*\[(\d+(?:,\s*\d+)*)\]/gi;
  const empiricalFramingMatches = Array.from(section.content.matchAll(empiricalFramingPattern));
  const misusedPerspectives: number[] = [];
  for (const match of empiricalFramingMatches) {
    const citedNums = match[1].split(',').map((s) => Number(s.trim()));
    for (const num of citedNums) {
      if (perspectiveCitations.has(num)) {
        misusedPerspectives.push(num);
      }
    }
  }
  if (misusedPerspectives.length > 0) {
    issues.push(`Citations ${[...new Set(misusedPerspectives)].join(', ')} are perspective/review papers but cited with empirical framing (e.g. "demonstrates", "achieves").`);
    suggestions.push('Use hedged framing for perspective/review sources: "argues that", "suggests that", "according to". Reserve empirical verbs for papers with evidence level "empirical".');
    scorePenalty += Math.min(10, misusedPerspectives.length * 3);
    majorCount++;
  }

  const overclaimingFindings = detectOverclaiming(section);
  if (overclaimingFindings.length > 0) {
    issues.push(`Potential overclaiming detected: ${overclaimingFindings.slice(0, 3).join(' | ')}`);
    suggestions.push('Avoid jumping from system existence to system effectiveness. Reserve strong performance claims for sentences grounded in empirical evidence or verbatim quotable findings.');
    scorePenalty += Math.min(12, overclaimingFindings.length * 3);
    if (overclaimingFindings.length >= 2) {
      majorCount++;
    }
  } else {
    strengths.push('No strong overclaiming patterns detected');
  }

  // --- template-kind-specific checks ---

  if (kind === 'benchmark') {
    if (!hasPaperType(paperTypeSignals, ['benchmark', 'evaluation'])) {
      issues.push('Benchmark section lacks benchmark/evaluation evidence.');
      suggestions.push('Include benchmark, dataset, or evaluation papers before finalizing this section.');
      scorePenalty += 18;
      criticalCount++;
    } else {
      strengths.push('Benchmark section includes benchmark/evaluation evidence');
    }
  }

  if (kind === 'systems') {
    if (!hasPaperType(paperTypeSignals, ['system', 'workflow', 'application'])) {
      issues.push('Systems section lacks system/workflow evidence.');
      suggestions.push('Add system, workflow, or platform papers to ground this section.');
      scorePenalty += 18;
      criticalCount++;
    } else {
      strengths.push('Systems section includes system/workflow evidence');
    }
  }

  if (kind === 'background') {
    if (!hasPaperType(paperTypeSignals, ['survey'])) {
      issues.push('Background section lacks survey/review style evidence.');
      suggestions.push('Anchor the background section with at least one survey, review, or overview paper.');
      scorePenalty += 8;
      majorCount++;
    } else {
      strengths.push('Background section includes survey-style evidence');
    }
  }

  if (kind === 'challenges') {
    const hasChallengeSignal = section.evidenceCards.some((card) =>
      card.paperTypeSignals.includes('challenges') ||
      /limit|challenge|future|reliability|ethic|open/i.test(card.limitationHint)
    );
    if (!hasChallengeSignal) {
      issues.push('Challenges section lacks explicit limitation or future-work evidence.');
      suggestions.push('Surface limitation and future-direction evidence instead of only summarizing methods.');
      scorePenalty += 10;
      majorCount++;
    } else {
      strengths.push('Challenges section includes limitation-oriented evidence');
    }
  }

  if (kind === 'methods') {
    if (!hasPaperType(paperTypeSignals, ['framework', 'architecture', 'method'])) {
      issues.push('Methods section lacks framework/architecture evidence.');
      suggestions.push('Include papers that describe specific method families, architectures, or frameworks.');
      scorePenalty += 10;
      majorCount++;
    } else {
      strengths.push('Methods section includes framework/architecture evidence');
    }
  }

  // Determine severity: only critical issues force rewrite
  const severity: HardCheckSeverity = criticalCount > 0 ? 'critical' : majorCount > 0 ? 'major' : 'minor';
  const forceRewrite = severity === 'critical';

  return {
    scorePenalty,
    strengths: uniqueTop(strengths),
    issues: uniqueTop(issues),
    suggestions: uniqueTop(suggestions),
    forceRewrite,
    severity,
    fabricatedNumbers,
    citationDistribution
  };
}

/**
 * Detect potentially fabricated numbers in section content by cross-referencing
 * with evidence card text. Numbers that appear in evidence cards are considered grounded.
 */
function detectFabricatedNumbers(section: SectionDraft, candidateText: string = section.content): string[] {
  const groundedNumbers = collectGroundedNumberTokens(section.evidenceCards);
  const supportedYears = new Set(section.evidenceCards.map((card) => String(card.year)).filter(Boolean));

  // Extract numbers from section content (skip citation markers [N])
  const contentWithoutCitations = candidateText.replace(/\[\d+\]/g, '');
  const fabricated: string[] = [];
  const isGrounded = (token: string): boolean => groundedNumbers.has(token) || supportedYears.has(token);
  const percentageRangePattern = /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*%/g;
  const timeRangePattern = /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s+times?\s+(?:faster|slower|more|less)\b/gi;

  // Check bounded percentage ranges such as "80-90%" or "40 to 50%"
  for (const match of contentWithoutCitations.matchAll(percentageRangePattern)) {
    if (!isGrounded(match[1]) || !isGrounded(match[2])) {
      fabricated.push(`${match[1]}-${match[2]}%`);
    }
  }

  // Check percentages
  const contentWithoutPercentageRanges = contentWithoutCitations.replace(percentageRangePattern, ' ');
  for (const match of contentWithoutPercentageRanges.matchAll(/(\d+(?:\.\d+)?)\s*%/g)) {
    if (!isGrounded(match[1])) {
      fabricated.push(`${match[1]}%`);
    }
  }

  // Check uncertainty ranges such as "2.34±1.99"
  for (const match of contentWithoutCitations.matchAll(/(\d+(?:\.\d+)?)\s*(?:±|\+\/-)\s*(\d+(?:\.\d+)?)\b/g)) {
    if (!isGrounded(match[1]) || !isGrounded(match[2])) {
      fabricated.push(`${match[1]}±${match[2]}`);
    }
  }

  // Check multipliers (3x, 4.3×)
  for (const match of contentWithoutCitations.matchAll(/(\d+(?:\.\d+)?)\s*[×x]\b/gi)) {
    if (!isGrounded(match[1])) {
      fabricated.push(`${match[1]}×`);
    }
  }

  // Check comparative time multipliers (e.g. "3-4 times faster", "2 times faster")
  for (const match of contentWithoutCitations.matchAll(timeRangePattern)) {
    if (!isGrounded(match[1]) || !isGrounded(match[2])) {
      fabricated.push(`${match[1]}-${match[2]} times`);
    }
  }
  const contentWithoutTimeRanges = contentWithoutCitations.replace(timeRangePattern, ' ');
  for (const match of contentWithoutTimeRanges.matchAll(/(\d+(?:\.\d+)?)\s+times?\s+(?:faster|slower|more|less)\b/gi)) {
    if (!isGrounded(match[1])) {
      fabricated.push(`${match[1]} times`);
    }
  }

  // A2: Check "N-fold" patterns (e.g. "5-fold improvement")
  for (const match of contentWithoutCitations.matchAll(/(\d+(?:\.\d+)?)-fold\b/gi)) {
    if (!isGrounded(match[1])) {
      fabricated.push(`${match[1]}-fold`);
    }
  }

  // A2: Check decimal scores presented as results (e.g. "F1 of 0.87", "BLEU score of 34.5")
  for (const match of contentWithoutCitations.matchAll(/(?:score|accuracy|F1|BLEU|ROUGE|precision|recall|AUC)\s+(?:of\s+)?(\d+(?:\.\d+)?)\b/gi)) {
    if (!isGrounded(match[1])) {
      fabricated.push(`score ${match[1]}`);
    }
  }

  // Check counted entities such as "57 agents", "22 classes", "18 benchmarks"
  for (const match of contentWithoutCitations.matchAll(/\b(\d{1,4}(?:\.\d+)?)\s+(?:tested\s+|distinct\s+|novel\s+|new\s+)?(agents?|classes?|benchmarks?|tasks?|papers?|systems?|datasets?|domains?|studies|samples?|participants?|workflows?)\b/gi)) {
    if (!isGrounded(match[1])) {
      fabricated.push(`${match[1]} ${match[2].toLowerCase()}`);
    }
  }

  // A2: Check "achieving/reaching/obtaining N" patterns with specific numbers
  for (const match of contentWithoutCitations.matchAll(/(?:achiev|reach|obtain|attain|record)(?:ing|ed|s)?\s+(?:a\s+)?(\d+(?:\.\d+)?)\b/gi)) {
    const num = match[1];
    // Skip years and small counts
    if (Number(num) > 100 || Number(num) < 1 || num.includes('.')) {
      if (!isGrounded(num)) {
        fabricated.push(`achieving ${num}`);
      }
    }
  }

  return Array.from(new Set(fabricated));
}

function extractLeadParagraph(content: string): string {
  const body = content.replace(/^## [^\n]+\n+/, '');
  const beforeSubsections = body.split(/\n###\s+/)[0] || body;
  return beforeSubsections.split('\n\n')[0]?.trim() || '';
}

function detectCitationPlaceholders(text: string): string[] {
  return Array.from(text.matchAll(/\[(N|TBD|\?+|citation needed|ref|refs?)\]/gi)).map((match) => match[0]);
}

function detectUnsupportedTableCells(section: SectionDraft): string[] {
  const lines = section.content.split('\n');
  const findings: string[] = [];
  let i = 0;

  const isTableRow = (line: string) => /^\|.+\|/.test(line.trim());
  const isTableSeparator = (line: string) => /^\|[\s:?-]+(\|[\s:?-]+)+\|?\s*$/.test(line.trim());
  const parseCells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

  while (i < lines.length) {
    if (!isTableRow(lines[i])) {
      i++;
      continue;
    }

    const table: string[] = [];
    while (i < lines.length && (isTableRow(lines[i]) || (table.length > 0 && isTableSeparator(lines[i])))) {
      table.push(lines[i]);
      i++;
    }

    for (let rowIndex = 2; rowIndex < table.length; rowIndex++) {
      const row = table[rowIndex];
      if (!isTableRow(row)) continue;

      const rowCitations = Array.from(row.matchAll(/\[(\d+)\]/g)).map((match) => Number(match[1]));
      const supportingCards = rowCitations.length > 0
        ? section.evidenceCards.filter((card) => rowCitations.includes(card.citation))
        : section.evidenceCards;
      const scopedSection: SectionDraft = {
        ...section,
        evidenceCards: supportingCards
      };

      for (const cell of parseCells(row)) {
        if (!/\d/.test(cell)) continue;
        const fabricated = detectFabricatedNumbers(scopedSection, cell);
        if (fabricated.length > 0) {
          findings.push(cell.replace(/\s+/g, ' ').slice(0, 60));
        }
      }
    }
  }

  return uniqueTop(findings, 4);
}

function detectOverclaiming(section: SectionDraft): string[] {
  const findings: string[] = [];
  const evidenceByCitation = new Map(section.evidenceCards.map((card) => [card.citation, card]));
  const sentences = section.content
    .replace(/^## [^\n]+\n+/, '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const strongClaimPattern = /\b(outperform|state-of-the-art|sota|superior|consistently|reliably|robust|high-performing|effective|effectively|guarantee|guarantees|validate|validated|substantial improvement|significant improvement|achieves? strong performance)\b/i;
  const existenceToEffectivenessPattern = /\b(system|framework|platform|workflow|agent)\b.*\b(effective|reliable|robust|accurate|successful|high-performing)\b/i;

  for (const sentence of sentences) {
    if (!strongClaimPattern.test(sentence) && !existenceToEffectivenessPattern.test(sentence)) {
      continue;
    }

    const citedCards = Array.from(sentence.matchAll(/\[(\d+)\]/g))
      .map((match) => Number(match[1]))
      .map((citation) => evidenceByCitation.get(citation))
      .filter((card): card is SectionDraft['evidenceCards'][number] => Boolean(card));

    if (citedCards.length === 0) {
      findings.push(sentence.slice(0, 120));
      continue;
    }

    const hasEmpiricalSupport = citedCards.some((card) => {
      const evidenceText = [
        card.keyContribution,
        card.groundedClaim,
        card.limitationHint,
        ...getQuotableFindings(card)
      ].join(' ');
      return card.evidenceLevel === 'empirical'
        || /\b(result|benchmark|evaluation|accuracy|f1|precision|recall|improv|outperform|performance)\b/i.test(evidenceText);
    });

    const onlyWeakEvidence = citedCards.every((card) => card.evidenceLevel === 'review' || card.evidenceLevel === 'perspective' || card.evidenceLevel === 'unknown');
    if (!hasEmpiricalSupport || onlyWeakEvidence) {
      findings.push(sentence.slice(0, 120));
    }
  }

  return uniqueTop(findings, 4);
}

/**
 * Check citation distribution: detect over-cited and un-cited evidence cards.
 */
function checkCitationDistribution(
  section: SectionDraft,
  citationMatches: number[],
  availableCitations: Set<number>
): { overCited: number[]; unCited: number[] } {
  const citationFrequency = new Map<number, number>();
  for (const citation of citationMatches) {
    if (availableCitations.has(citation)) {
      citationFrequency.set(citation, (citationFrequency.get(citation) || 0) + 1);
    }
  }

  // Over-cited: appears more than 5 times in a single section
  const overCited = Array.from(citationFrequency.entries())
    .filter(([, count]) => count > 5)
    .map(([citation]) => citation);

  // Un-cited: available evidence cards never referenced
  const unCited = Array.from(availableCitations)
    .filter((citation) => !citationFrequency.has(citation));

  return { overCited, unCited };
}

function mergeReviewWithHardChecks(review: ReviewResponse, hardChecks: HardCheckResult): ReviewResponse {
  const score = Math.max(0, Math.min(100, review.score - hardChecks.scorePenalty));

  return {
    score,
    strengths: uniqueTop([...hardChecks.strengths, ...review.strengths]),
    issues: uniqueTop([...hardChecks.issues, ...review.issues]),
    suggestions: uniqueTop([...hardChecks.suggestions, ...review.suggestions]),
    needsRewrite: Boolean(review.needsRewrite || hardChecks.forceRewrite)
  };
}

function hasPaperType(signals: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => signals.has(candidate));
}

function runCrossSectionChecks(sections: SectionDraft[]): Map<string, CrossSectionFeedback> {
  const feedback = new Map<string, CrossSectionFeedback>();
  const addFeedback = (sectionId: string, issue: string, suggestion: string, scorePenalty: number, forceRewrite: boolean) => {
    const existing = feedback.get(sectionId) || {
      scorePenalty: 0,
      issues: [],
      suggestions: [],
      forceRewrite: false
    };
    existing.scorePenalty += scorePenalty;
    existing.issues.push(issue);
    existing.suggestions.push(suggestion);
    existing.forceRewrite = existing.forceRewrite || forceRewrite;
    feedback.set(sectionId, existing);
  };

  const citationSets = sections.map((section) => new Set(
    Array.from(section.content.matchAll(/\[(\d+)\]/g)).map((match) => Number(match[1]))
  ));
  const leadParagraphs = sections.map((section) => extractLeadParagraph(section.content).toLowerCase());
  const paperUsage = new Map<string, string[]>();

  for (const section of sections) {
    for (const card of section.evidenceCards) {
      const key = card.title.toLowerCase();
      paperUsage.set(key, [...(paperUsage.get(key) || []), section.sectionId]);
    }
  }

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const intersection = Array.from(citationSets[i]).filter((citation) => citationSets[j].has(citation));
      const minSize = Math.max(1, Math.min(citationSets[i].size || 1, citationSets[j].size || 1));
      const overlapRatio = intersection.length / minSize;
      const leadSimilarity = computeTokenJaccard(leadParagraphs[i], leadParagraphs[j]);

      if ((intersection.length >= 2 && overlapRatio >= 0.6) || (intersection.length >= 1 && leadSimilarity >= 0.45)) {
        addFeedback(
          sections[j].sectionId,
          `Cross-section redundancy with "${sections[i].title}" detected: shared evidence overlap is high.`,
          `Differentiate "${sections[j].title}" from "${sections[i].title}" by using a more section-specific angle, trimming repeated paper descriptions, and foregrounding evidence not already emphasized earlier.`,
          8,
          true
        );
      }
    }
  }

  for (const [paperTitle, sectionIds] of paperUsage.entries()) {
    if (sectionIds.length <= 2) continue;
    for (const sectionId of sectionIds.slice(1)) {
      addFeedback(
        sectionId,
        `Paper "${paperTitle}" is reused across multiple sections, increasing redundancy risk.`,
        'When reusing the same paper across sections, keep the angle consistent and only retain details that are uniquely relevant to this section.',
        3,
        false
      );
    }
  }

  return feedback;
}

function computeTokenJaccard(left: string, right: string): number {
  const leftTokens = new Set(left.split(/[^a-z0-9]+/).filter((token) => token.length >= 4));
  const rightTokens = new Set(right.split(/[^a-z0-9]+/).filter((token) => token.length >= 4));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  const intersection = Array.from(leftTokens).filter((token) => rightTokens.has(token));
  const unionSize = new Set([...leftTokens, ...rightTokens]).size;
  return unionSize > 0 ? intersection.length / unionSize : 0;
}

function uniqueTop(items: string[], limit: number = 6): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}
