import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { FinalSurvey, SectionDraft, SurveyOutline, SurveyQualityReport } from './types.js';
import { checkCitationConsistency, countWords, normalizeText, stripGhostCitations } from './utils.js';
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

  // Remove template artifact leaks (e.g. "Closing move:" prefix from section templates)
  cleaned = cleaned.replace(/\b(Closing move|Opening move|Required move|Rhetorical goal)\s*:\s*/gi, '');

  // Remove ALL ## level headings from the body — the assembler will prepend the
  // canonical heading.  This catches mismatched titles produced by LLM rewrites
  // (e.g. "## Background and Scope" when the outline title is "Background and Evolution").
  cleaned = cleaned.replace(/^##\s+[^\n]+\n*/gm, '');

  // Re-prepend the single canonical heading
  cleaned = `## ${sectionTitle}\n\n${cleaned.trimStart()}`;

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
 * Generate a conclusion using LLM based on actual section content.
 * Falls back to a template if LLM call fails.
 */
async function generateConclusion(
  context: SkillContext | null,
  outline: SurveyOutline,
  sections: SectionDraft[]
): Promise<string> {
  if (!context) {
    return generateFallbackConclusion(outline, sections.map((s) => s.title));
  }

  const sectionSummaries = sections.map((s) => {
    const firstParagraph = s.content.replace(/^##[^\n]*\n+/, '').split('\n\n')[0] || '';
    return `- ${s.title}: ${firstParagraph.slice(0, 200)}...`;
  }).join('\n');

  const prompt = `Write a conclusion section (## Conclusion) for a survey titled "${outline.title}".

The survey covers these sections:
${sectionSummaries}

Requirements:
- Start with "## Conclusion"
- 150-250 words
- Summarize the key findings across sections (do NOT repeat section content verbatim)
- Identify 2-3 concrete open challenges or future directions
- End with a forward-looking statement about the field
- Do NOT use generic platitudes — be specific to the surveyed evidence
- Do NOT include citations [N] in the conclusion`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You write concise, specific survey conclusions.' },
      { role: 'user', content: prompt }
    ]);
    const content = normalizeText(response.content);
    if (content && content.length > 50) {
      return content.startsWith('## ') ? content : `## Conclusion\n\n${content}`;
    }
  } catch {
    // Fall through to template
  }

  return generateFallbackConclusion(outline, sections.map((s) => s.title));
}

function generateFallbackConclusion(outline: SurveyOutline, sectionTitles: string[]): string {
  const sectionList = sectionTitles.map((t) => t.replace(/^##\s*/, '')).join(', ');
  return `## Conclusion\n\nThis survey has examined ${outline.title.replace(/^A Survey of /i, '').toLowerCase()} through the lenses of ${sectionList.toLowerCase()}. The field continues to advance rapidly, with emerging systems demonstrating increasing autonomy in scientific workflows. Key open challenges include improving reliability, ensuring ethical deployment, and developing comprehensive evaluation frameworks. Future work should prioritize bridging the gap between narrow task automation and truly open-ended scientific discovery.`;
}

export async function assembleSurvey(
  outline: SurveyOutline,
  sections: SectionDraft[],
  papers: Paper[],
  qualityReport: SurveyQualityReport,
  context?: SkillContext
): Promise<FinalSurvey> {
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

  const conclusion = await generateConclusion(context || null, outline, cleanedSections);

  // Embed taxonomy as a compact paragraph in the abstract footer rather than a standalone section
  const taxonomyLine = outline.taxonomy.length > 0
    ? `\n\n**Keywords**: ${outline.taxonomy.join(', ')}`
    : '';

  const markdownParts = [
    `# ${outline.title}`,
    '## Abstract',
    outline.abstractDraft + taxonomyLine,
    ...cleanedSections.map((section) => section.content),
    conclusion,
    '## References',
    references
  ].filter(Boolean);

  // Final ghost-citation strip on the fully assembled markdown
  // (catches citations introduced by LLM conclusion or rewrite that escaped per-section strip)
  const markdown = stripGhostCitations(markdownParts.join('\n\n'), referenceCount);

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
