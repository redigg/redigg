import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { FinalSurvey, SectionDraft, SurveyOutline, SurveyQualityReport } from './types.js';
import { checkCitationConsistency, countWords, stripGhostCitations } from './utils.js';

/**
 * Clean LLM-generated section content:
 * - Remove markdown code fences (```markdown ... ```)
 * - Remove LLM preamble like "Here's the revised section..."
 * - Remove duplicate heading if section already starts with ## Title
 * - Trim blank lines
 */
function cleanSectionContent(content: string, sectionTitle: string): string {
  let cleaned = content;

  // Remove markdown code fences wrapping the content
  cleaned = cleaned.replace(/```(?:markdown)?\s*\n([\s\S]*?)```/g, '$1');

  // Remove common LLM preamble lines
  cleaned = cleaned.replace(/^(?:Here(?:'s| is) the (?:revised|improved|updated|rewritten) (?:section|version|content)[^\n]*\n+)/im, '');

  // If the content has the section heading duplicated, keep only the first occurrence
  const headingPattern = new RegExp(`^(##\\s+${escapeRegex(sectionTitle)}\\s*\\n)`, 'gm');
  const matches = cleaned.match(headingPattern);
  if (matches && matches.length > 1) {
    // Remove all but the first occurrence
    let found = false;
    cleaned = cleaned.replace(headingPattern, (match) => {
      if (!found) { found = true; return match; }
      return '';
    });
  }

  // Ensure section starts with its heading
  const hasHeading = cleaned.trimStart().startsWith(`## ${sectionTitle}`);
  if (!hasHeading) {
    cleaned = `## ${sectionTitle}\n\n${cleaned.trimStart()}`;
  }

  return cleaned.replace(/\n{4,}/g, '\n\n\n').trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

  // Strip ghost citations and clean LLM artifacts from each section
  const cleanedSections = sections.map((section) => ({
    ...section,
    content: cleanSectionContent(
      stripGhostCitations(section.content, referenceCount),
      section.title
    )
  }));

  const markdownParts = [
    `# ${outline.title}`,
    '## Abstract',
    outline.abstractDraft,
    '## Taxonomy',
    ...outline.taxonomy.map((item) => `- ${item}`),
    ...cleanedSections.map((section) => section.content),
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
