import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyQualityReport } from './types.js';
import { parseJsonObject, normalizeText } from './utils.js';

interface ReviewResponse {
  score: number;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  needsRewrite?: boolean;
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
    let finalSection = section;
    let rewriteApplied = false;

    if (review.score < 75 || review.needsRewrite) {
      const rewritten = await rewriteSection(context, topic, section, review.suggestions);
      if (rewritten) {
        finalSection = {
          ...section,
          content: rewritten
        };
        rewriteApplied = true;
      }
    }

    reviewedSections.push(finalSection);
    sectionReviews.push({
      sectionId: section.sectionId,
      score: review.score,
      strengths: review.strengths,
      issues: review.issues,
      suggestions: review.suggestions,
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
  const prompt = `
[SURVEY_SECTION_REVIEW]
Topic: ${topic}
Review the following survey section.

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
  const prompt = `
[SURVEY_SECTION_REWRITE]
Topic: ${topic}
Improve the following survey section using these suggestions:
${suggestions.join('\n') || 'Improve clarity and evidence grounding.'}

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
