import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { FinalSurvey, SectionDraft, SurveyOutline, SurveyQualityReport } from './types.js';
import { countWords } from './utils.js';

export function assembleSurvey(
  outline: SurveyOutline,
  sections: SectionDraft[],
  papers: Paper[],
  qualityReport: SurveyQualityReport
): FinalSurvey {
  const references = papers
    .map((paper, index) => `${index + 1}. ${paper.title}. ${paper.journal || 'Unknown venue'}, ${paper.year}. ${paper.url || ''}`.trim())
    .join('\n');

  const markdownParts = [
    `# ${outline.title}`,
    '## Abstract',
    outline.abstractDraft,
    '## Taxonomy',
    ...outline.taxonomy.map((item) => `- ${item}`),
    ...sections.map((section) => section.content),
    '## Review Summary',
    `Overall score: ${qualityReport.overallScore}/100`,
    ...qualityReport.suggestions.map((item) => `- ${item}`),
    '## References',
    references
  ].filter(Boolean);

  const markdown = markdownParts.join('\n\n');

  return {
    title: outline.title,
    markdown,
    sections,
    wordCount: countWords(markdown),
    citationCount: papers.length
  };
}
