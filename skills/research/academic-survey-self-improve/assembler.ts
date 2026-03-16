import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { FinalSurvey, SectionDraft, SurveyOutline, SurveyQualityReport } from './types.js';
import { checkCitationConsistency, countWords, stripGhostCitations } from './utils.js';

export function assembleSurvey(
  outline: SurveyOutline,
  sections: SectionDraft[],
  papers: Paper[],
  qualityReport: SurveyQualityReport
): FinalSurvey {
  const referenceCount = papers.length;
  const references = papers
    .map((paper, index) => `${index + 1}. ${paper.title}. ${paper.journal || 'Unknown venue'}, ${paper.year}. ${paper.url || ''}`.trim())
    .join('\n');

  // Strip ghost citations from each section before assembly
  const cleanedSections = sections.map((section) => ({
    ...section,
    content: stripGhostCitations(section.content, referenceCount)
  }));

  const markdownParts = [
    `# ${outline.title}`,
    '## Abstract',
    outline.abstractDraft,
    '## Taxonomy',
    ...outline.taxonomy.map((item) => `- ${item}`),
    ...cleanedSections.map((section) => section.content),
    '## Review Summary',
    `Overall score: ${qualityReport.overallScore}/100`,
    ...qualityReport.suggestions.map((item) => `- ${item}`),
    '## References',
    references
  ].filter(Boolean);

  const markdown = markdownParts.join('\n\n');

  // Run bidirectional consistency check on assembled output
  const consistency = checkCitationConsistency(markdown, referenceCount);

  return {
    title: outline.title,
    markdown,
    sections: cleanedSections,
    wordCount: countWords(markdown),
    citationCount: referenceCount,
    citationConsistency: {
      ghostCitations: consistency.ghostCitations,
      orphanReferences: consistency.orphanReferences,
      isConsistent: consistency.isConsistent
    }
  };
}
