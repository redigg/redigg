import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyQualityReport } from './types.js';
import { alignClaimsToEvidence, countWords, normalizeText, parseJsonObject } from './utils.js';

interface ReviewResponse {
  score: number;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  needsRewrite?: boolean;
}

interface HardCheckResult {
  scorePenalty: number;
  strengths: string[];
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
    const review = await reviewSection(context, topic, section);
    const hardChecks = runHardChecks(section);
    const finalReview = mergeReviewWithHardChecks(review, hardChecks);
    let finalSection = section;
    let rewriteApplied = false;

    if (finalReview.score < 75 || finalReview.needsRewrite) {
      const rewritten = await rewriteSection(context, topic, section, finalReview.suggestions);
      if (rewritten) {
        finalSection = {
          ...section,
          content: rewritten,
          claimAlignments: alignClaimsToEvidence(rewritten, section.evidenceCards, section.claimAlignments)
        };
        rewriteApplied = true;
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

  const overallScore = sectionReviews.length > 0
    ? Math.round(sectionReviews.reduce((sum, item) => sum + item.score, 0) / sectionReviews.length)
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

async function reviewSection(
  context: SkillContext,
  topic: string,
  section: SectionDraft
): Promise<ReviewResponse> {
  const evidenceSummary = section.evidenceCards
    .map((card) => `[${card.citation}] ${card.title} | focus: ${card.evidenceFocus.join(', ') || 'general'} | claim: ${card.groundedClaim}`)
    .join('\n');
  const prompt = `
[SURVEY_SECTION_REVIEW]
Topic: ${topic}
Review the following survey section.

Available evidence cards:
${evidenceSummary || 'No evidence cards available.'}

${section.content}

Return ONLY valid JSON:
{
  "score": 80,
  "strengths": ["string"],
  "issues": ["string"],
  "suggestions": ["string"],
  "needsRewrite": false
}
`;

  const response = await context.llm.chat([
    { role: 'system', content: 'You review academic survey sections for coverage, grounding, and clarity.' },
    { role: 'user', content: prompt }
  ]);

  const parsed = parseJsonObject<Partial<ReviewResponse>>(response.content);
  return {
    score: Number(parsed?.score) > 0 ? Number(parsed?.score) : 80,
    strengths: Array.isArray(parsed?.strengths) && parsed!.strengths!.length > 0 ? parsed!.strengths!.map(String) : ['Grounded in retrieved papers'],
    issues: Array.isArray(parsed?.issues) ? parsed!.issues!.map(String) : [],
    suggestions: Array.isArray(parsed?.suggestions) ? parsed!.suggestions!.map(String) : [],
    needsRewrite: Boolean(parsed?.needsRewrite)
  };
}

async function rewriteSection(
  context: SkillContext,
  topic: string,
  section: SectionDraft,
  suggestions: string[]
): Promise<string | null> {
  const evidenceSummary = section.evidenceCards
    .map((card) => `[${card.citation}] ${card.title}\n- Grounded claim: ${card.groundedClaim}\n- Limitation hint: ${card.limitationHint}`)
    .join('\n');
  const claimSummary = section.claimAlignments
    .map((item) => `- Claim: ${item.claim}\n  Citations: ${item.citations.join(', ')}`)
    .join('\n');
  const prompt = `
[SURVEY_SECTION_REWRITE]
Topic: ${topic}
Improve the following survey section using these suggestions:
${suggestions.join('\n') || 'Improve clarity and evidence grounding.'}

You must stay within the following evidence cards:
${evidenceSummary || 'No evidence cards available.'}

Current claim-to-citation alignments:
${claimSummary || 'No claim alignments available.'}

${section.content}

Return ONLY the revised Markdown section.
`;

  const response = await context.llm.chat([
    { role: 'system', content: 'You revise academic survey sections without changing their scope.' },
    { role: 'user', content: prompt }
  ]);

  const content = normalizeText(response.content);
  return content || null;
}

function runHardChecks(section: SectionDraft): HardCheckResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const strengths: string[] = [];
  let scorePenalty = 0;
  let forceRewrite = false;

  const normalizedTitle = section.title.toLowerCase();
  const wordCount = countWords(section.content);
  const citationMatches = Array.from(section.content.matchAll(/\[(\d+)\]/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const usedCitations = new Set(citationMatches);
  const availableCitations = new Set(section.evidenceCards.map((card) => card.citation));
  const paperTypeSignals = new Set(section.evidenceCards.flatMap((card) => card.paperTypeSignals));
  const claimAlignments = section.claimAlignments || [];

  if (section.evidenceCards.length === 0) {
    issues.push('No evidence cards were attached to this section.');
    suggestions.push('Retrieve and attach grounded evidence cards before drafting this section.');
    scorePenalty += 25;
    forceRewrite = true;
  } else {
    strengths.push(`Grounded in ${section.evidenceCards.length} evidence cards`);
  }

  if (usedCitations.size === 0) {
    issues.push('The section does not cite any supporting evidence.');
    suggestions.push('Add inline citations that point back to the available evidence cards.');
    scorePenalty += 18;
    forceRewrite = true;
  } else if (section.evidenceCards.length > 1 && usedCitations.size < 2) {
    issues.push('The section relies on too few distinct evidence cards.');
    suggestions.push('Use at least two distinct citations when multiple evidence cards are available.');
    scorePenalty += 8;
  } else {
    strengths.push('Uses multiple evidence-backed citations');
  }

  const unknownCitations = Array.from(usedCitations).filter((citation) => !availableCitations.has(citation));
  if (unknownCitations.length > 0) {
    issues.push(`The section references citations not present in its evidence cards: ${unknownCitations.join(', ')}.`);
    suggestions.push('Align every inline citation with the evidence cards attached to this section.');
    scorePenalty += 12;
    forceRewrite = true;
  }

  if (claimAlignments.length === 0) {
    issues.push('The section does not expose claim-level citation alignment.');
    suggestions.push('Identify the core sentence-level claims in this section and map each of them to explicit evidence-card citations.');
    scorePenalty += 10;
    forceRewrite = true;
  } else {
    strengths.push(`Tracks ${claimAlignments.length} claim-level citation alignments`);
  }

  const invalidClaimMappings = claimAlignments.filter((item) =>
    item.citations.length === 0 || item.citations.some((citation) => !availableCitations.has(citation))
  );
  if (invalidClaimMappings.length > 0) {
    issues.push('Some claim-level citation mappings reference citations outside this section evidence set.');
    suggestions.push('Ensure every aligned claim only references citations from this section’s evidence cards.');
    scorePenalty += 10;
    forceRewrite = true;
  }

  if (wordCount < 80) {
    issues.push('The section is too short to provide a useful synthesis.');
    suggestions.push('Expand the section with a clearer synthesis of the retrieved evidence.');
    scorePenalty += 10;
    forceRewrite = true;
  }

  if (normalizedTitle.includes('benchmark') || normalizedTitle.includes('evaluation')) {
    if (!hasPaperType(paperTypeSignals, ['benchmark', 'evaluation'])) {
      issues.push('Benchmark section lacks benchmark/evaluation evidence.');
      suggestions.push('Include benchmark, dataset, or evaluation papers before finalizing this section.');
      scorePenalty += 18;
      forceRewrite = true;
    } else {
      strengths.push('Benchmark section includes benchmark/evaluation evidence');
    }
  }

  if (normalizedTitle.includes('system') || normalizedTitle.includes('application')) {
    if (!hasPaperType(paperTypeSignals, ['system', 'workflow', 'application'])) {
      issues.push('Systems section lacks system/workflow evidence.');
      suggestions.push('Add system, workflow, or platform papers to ground this section.');
      scorePenalty += 18;
      forceRewrite = true;
    } else {
      strengths.push('Systems section includes system/workflow evidence');
    }
  }

  if (normalizedTitle.includes('background') || normalizedTitle.includes('scope')) {
    if (!hasPaperType(paperTypeSignals, ['survey'])) {
      issues.push('Background section lacks survey/review style evidence.');
      suggestions.push('Anchor the background section with at least one survey, review, or overview paper.');
      scorePenalty += 8;
    } else {
      strengths.push('Background section includes survey-style evidence');
    }
  }

  if (normalizedTitle.includes('challenge') || normalizedTitle.includes('future')) {
    const hasChallengeSignal = section.evidenceCards.some((card) =>
      card.paperTypeSignals.includes('challenges') ||
      /limit|challenge|future|reliability|ethic|open/i.test(card.limitationHint)
    );
    if (!hasChallengeSignal) {
      issues.push('Challenges section lacks explicit limitation or future-work evidence.');
      suggestions.push('Surface limitation and future-direction evidence instead of only summarizing methods.');
      scorePenalty += 10;
    } else {
      strengths.push('Challenges section includes limitation-oriented evidence');
    }
  }

  return {
    scorePenalty,
    strengths: uniqueTop(strengths),
    issues: uniqueTop(issues),
    suggestions: uniqueTop(suggestions),
    forceRewrite
  };
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

function uniqueTop(items: string[], limit: number = 6): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}
