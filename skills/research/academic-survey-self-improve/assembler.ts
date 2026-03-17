import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { FinalSurvey, SectionDraft, SurveyOutline, SurveyQualityReport } from './types.js';
import { checkCitationConsistency, countWords, stripGhostCitations } from './utils.js';
import { convertToLatex } from './latex-converter.js';

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

/**
 * Extract all citation numbers used in the body text.
 */
function extractUsedCitations(sections: SectionDraft[]): Set<number> {
  const used = new Set<number>();
  for (const section of sections) {
    const matches = section.content.matchAll(/\[(\d+)\]/g);
    for (const match of matches) {
      const num = Number(match[1]);
      if (Number.isFinite(num) && num > 0) used.add(num);
    }
  }
  return used;
}

/**
 * Remove orphan references (not cited in body) and renumber all citations
 * so references are contiguous [1], [2], [3]...
 */
function pruneAndRenumber(
  sections: SectionDraft[],
  papers: Paper[]
): { sections: SectionDraft[]; papers: Paper[] } {
  const used = extractUsedCitations(sections);
  if (used.size === 0) return { sections, papers };

  // Build old→new mapping (only keep cited papers)
  const renumberMap = new Map<number, number>();
  const keptPapers: Paper[] = [];
  let newIndex = 1;
  for (let i = 0; i < papers.length; i++) {
    const oldIndex = i + 1;
    if (used.has(oldIndex)) {
      renumberMap.set(oldIndex, newIndex);
      keptPapers.push(papers[i]);
      newIndex++;
    }
  }

  // If nothing was pruned, skip renumbering
  if (keptPapers.length === papers.length) return { sections, papers };

  // Renumber citations in section content; drop citations that reference pruned papers
  const renumberedSections = sections.map((section) => ({
    ...section,
    content: section.content.replace(/\[(\d+)\]/g, (_match, num) => {
      const oldNum = Number(num);
      const newNum = renumberMap.get(oldNum);
      return newNum ? `[${newNum}]` : ''; // Remove citation if paper was pruned
    })
  }));

  return { sections: renumberedSections, papers: keptPapers };
}

/**
 * Generate a brief conclusion paragraph from the section titles and outline.
 */
function generateConclusion(outline: SurveyOutline, sectionTitles: string[]): string {
  const sectionList = sectionTitles.map((t) => t.replace(/^##\s*/, '')).join(', ');
  return `## Conclusion\n\nThis survey has examined ${outline.title.replace(/^A Survey of /i, '').toLowerCase()} through the lenses of ${sectionList.toLowerCase()}. The field continues to advance rapidly, with emerging systems demonstrating increasing autonomy in scientific workflows. Key open challenges include improving reliability, ensuring ethical deployment, and developing comprehensive evaluation frameworks. Future work should prioritize bridging the gap between narrow task automation and truly open-ended scientific discovery.`;
}

export function assembleSurvey(
  outline: SurveyOutline,
  sections: SectionDraft[],
  papers: Paper[],
  qualityReport: SurveyQualityReport
): FinalSurvey {
  // Clean LLM artifacts from each section (no ghost strip yet — happens after pruning)
  let cleanedSections = sections.map((section) => ({
    ...section,
    content: cleanSectionContent(section.content, section.title)
  }));

  // Prune orphan references, renumber citations, and drop dangling refs
  const pruned = pruneAndRenumber(cleanedSections, papers);
  cleanedSections = pruned.sections;
  const finalPapers = pruned.papers;
  const referenceCount = finalPapers.length;

  // Now strip any remaining ghost citations (citations > final ref count)
  cleanedSections = cleanedSections.map((section) => ({
    ...section,
    content: stripGhostCitations(section.content, referenceCount)
  }));

  const references = finalPapers
    .map((paper, index) => `${index + 1}. ${paper.title}. ${paper.journal || 'Unknown venue'}, ${paper.year}. ${paper.url || ''}`.trim())
    .join('\n');

  const sectionTitles = cleanedSections.map((s) => s.title);
  const conclusion = generateConclusion(outline, sectionTitles);

  const markdownParts = [
    `# ${outline.title}`,
    '## Abstract',
    outline.abstractDraft,
    '## Taxonomy',
    ...outline.taxonomy.map((item) => `- ${item}`),
    ...cleanedSections.map((section) => section.content),
    conclusion,
    '## References',
    references
  ].filter(Boolean);

  const markdown = markdownParts.join('\n\n');

  // Run bidirectional consistency check on assembled output
  const consistency = checkCitationConsistency(markdown, referenceCount);

  // Generate LaTeX version
  let latex: string | undefined;
  try {
    const surveyForLatex: FinalSurvey = {
      title: outline.title,
      markdown,
      sections: cleanedSections,
      referencedPapers: finalPapers,
      wordCount: countWords(markdown),
      citationCount: referenceCount,
      citationConsistency: {
        ghostCitations: consistency.ghostCitations,
        orphanReferences: consistency.orphanReferences,
        isConsistent: consistency.isConsistent
      }
    };
    latex = convertToLatex(outline, surveyForLatex, finalPapers);
  } catch {
    // LaTeX generation is non-critical; continue without it
  }

  return {
    title: outline.title,
    markdown,
    latex,
    sections: cleanedSections,
    referencedPapers: finalPapers,
    wordCount: countWords(markdown),
    citationCount: referenceCount,
    citationConsistency: {
      ghostCitations: consistency.ghostCitations,
      orphanReferences: consistency.orphanReferences,
      isConsistent: consistency.isConsistent
    }
  };
}
