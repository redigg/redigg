import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { FinalSurvey, SectionDraft, SurveyFigure, SurveyOutline, SurveyQualityReport } from './types.js';
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

  // Remove common LLM preamble lines (global — catches multiple occurrences)
  cleaned = cleaned.replace(/^(?:Here(?:'s| is) (?:the |a |my )?(?:revised|improved|updated|rewritten|expanded|new)[^\n]*(?:section|version|content|draft|text)[^\n]*\n+)/gim, '');

  // Remove LLM postamble / self-evaluation blocks at the end of sections
  // Matches patterns like "This revision expands to...", "This expanded analysis...",
  // "The revised section expands...", "Word count: N", etc.
  cleaned = cleaned.replace(/\n+(?:This (?:revision|revised|expanded|updated|rewritten)[^\n]*(?:expands?|incorporates?|improves?|includes?|adds?)[^\n]*(?:\n(?:\d+\.\s+[^\n]+))*)\s*$/gi, '');
  cleaned = cleaned.replace(/\n+(?:The revised (?:section|version)[^\n]*)\s*$/gi, '');

  // Remove inline "(Word count: N)" or "(Word count: N,NNN)"
  cleaned = cleaned.replace(/\s*\(Word count:\s*[\d,]+\)\s*/gi, ' ');

  // Remove standalone "Word count: N" lines
  cleaned = cleaned.replace(/^\s*Word count:\s*[\d,]+\s*$/gim, '');

  // Remove numbered meta-commentary lists (e.g. "1. New subsections organizing...", "2. Deeper synthesis...")
  // Only when preceded by a meta line like "This revision..." or at the very end
  cleaned = cleaned.replace(/\n+(?:\d+\.\s+(?:New|Deeper|Enhanced|Improved|Added|Consolidated|Unified|Better|Clearer|Expanded|Strengthened)[^\n]+(?:\n\d+\.\s+(?:New|Deeper|Enhanced|Improved|Added|Consolidated|Unified|Better|Clearer|Expanded|Strengthened)[^\n]+)*)\s*$/gi, '');

  // Remove template artifact leaks (e.g. "Closing move:" prefix from section templates)
  cleaned = cleaned.replace(/\b(Closing move|Opening move|Required move|Rhetorical goal)\s*:\s*/gi, '');

  // Remove horizontal rules (--- or ***) which are LLM formatting artifacts
  cleaned = cleaned.replace(/^\s*[-*]{3,}\s*$/gm, '');

  // A4: Remove "I hope this..." / "I've expanded..." / "Let me know..." artifacts
  cleaned = cleaned.replace(/^\s*(?:I(?:'ve| have) (?:expanded|revised|updated|rewritten|improved)[^\n]*)\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*(?:Let me know if[^\n]*)\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*(?:I hope this[^\n]*)\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*(?:Please (?:let me know|note)[^\n]*)\s*$/gim, '');

  // A4: Remove "Note:" meta-commentary (but keep academic "Note that" in prose)
  cleaned = cleaned.replace(/^\s*Note:\s*(?:This|The|I|My|Each|All)[^\n]*$/gim, '');

  // A4: Remove JSON/schema artifacts that leaked into text
  cleaned = cleaned.replace(/^\s*[{}\[\]]\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*"(?:markdown|claimMappings|claim|citations)":\s*/gm, '');

  // A4: Remove lines that are just "---" dividers between logical sections
  cleaned = cleaned.replace(/\n---\n/g, '\n\n');

  // Remove ALL ## level headings from the body — the assembler will prepend the
  // canonical heading.  This catches mismatched titles produced by LLM rewrites
  // (e.g. "## Background and Scope" when the outline title is "Background and Evolution").
  cleaned = cleaned.replace(/^##\s+[^\n]+\n*/gm, '');

  // Re-prepend the single canonical heading
  cleaned = `## ${sectionTitle}\n\n${cleaned.trimStart()}`;

  return cleaned.replace(/\n{4,}/g, '\n\n\n').trim();
}

/**
 * A3: Format a single reference entry with proper academic bibliography format.
 * Fixes: OpenAlex as venue name, author encoding, missing first authors.
 */
function formatReference(paper: Paper, index: number): string {
  // Format authors: "FirstAuthor, SecondAuthor, and ThirdAuthor"
  const authors = formatAuthors(paper.authors || []);

  // Fix venue: replace "OpenAlex" or empty venue with source-derived venue
  let venue = paper.journal || '';
  if (!venue || venue.toLowerCase() === 'openalex' || venue.toLowerCase() === 'unknown venue') {
    // Try to derive venue from URL or source
    if (paper.url?.includes('arxiv.org')) {
      venue = 'arXiv preprint';
    } else if (paper.source === 'arxiv') {
      venue = 'arXiv preprint';
    } else {
      venue = 'Preprint';
    }
  }

  // Build DOI suffix if available
  const doiSuffix = paper.doi ? ` DOI: ${paper.doi}` : '';
  const urlSuffix = !paper.doi && paper.url ? ` ${paper.url}` : '';

  return `${index}. ${authors}. ${paper.title}. *${venue}*, ${paper.year}.${doiSuffix}${urlSuffix}`.trim();
}

/**
 * Format author list for bibliography. Handles encoding issues and truncation.
 */
function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Unknown Authors';

  // Fix common encoding issues (mojibake from UTF-8 → Latin-1 round-trips)
  const cleaned = authors.map((a) =>
    a.replace(/Ã¤/g, 'ä').replace(/Ã¶/g, 'ö').replace(/Ã¼/g, 'ü')
      .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ã§/g, 'ç')
      .replace(/Ã±/g, 'ñ').replace(/Ã³/g, 'ó').replace(/Ã¡/g, 'á')
      .replace(/Ã­/g, 'í').replace(/Ãº/g, 'ú')
      .trim()
  ).filter(Boolean);

  if (cleaned.length === 0) return 'Unknown Authors';
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  if (cleaned.length <= 5) return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
  // Truncate long author lists
  return `${cleaned.slice(0, 3).join(', ')}, et al.`;
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
- 300-500 words (substantial, not a brief paragraph)
- Structure the conclusion as follows:

(a) **Key Findings Summary** (1-2 paragraphs): Synthesize the main insights from across all sections. What are the dominant patterns? What consensus has emerged? What fundamental tensions exist?

(b) **Open Problems** (bulleted list of 3-5 items): Identify concrete, specific unresolved challenges. Each should be a one-sentence description of a problem that remains unsolved, grounded in the surveyed evidence.

(c) **Future Directions** (2-3 items): Propose actionable research directions that would address the open problems. Be specific — not "more research is needed" but "integrating X with Y to address Z".

(d) **Closing Statement** (1 sentence): A forward-looking statement about the field's trajectory.

- Do NOT use generic platitudes — be specific to the surveyed evidence
- Do NOT include citations [N] in the conclusion
- Do NOT repeat section content verbatim`;

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
  const topic = outline.title.replace(/^A Survey of /i, '').replace(/^Survey on /i, '');
  const sectionList = sectionTitles.map((t) => t.replace(/^##\s*/, '')).join(', ');
  return `## Conclusion

This survey has examined ${topic.toLowerCase()} through the lenses of ${sectionList.toLowerCase()}. The field continues to advance rapidly, with emerging systems demonstrating increasing autonomy and capability.

Several open problems remain unresolved:

- Reliability and reproducibility of results across different experimental settings and domains
- Scalability of current approaches to real-world, open-ended problem spaces
- Development of comprehensive evaluation frameworks that capture both quantitative and qualitative aspects of performance
- Ethical considerations and responsible deployment in sensitive application areas
- Integration of multiple complementary approaches into unified, robust systems

Future research should prioritize bridging the gap between narrow task automation and truly open-ended scientific discovery. Specifically, developing standardized evaluation protocols that enable fair comparison across methods, and designing systems that can gracefully handle the uncertainty inherent in complex scientific reasoning, represent promising directions.

As ${topic.toLowerCase()} matures, the convergence of improved methods, richer benchmarks, and deeper theoretical understanding will be essential for translating current progress into sustained, practical impact.`;
}

/**
 * W1: Rewrite abstract based on actual section content rather than the outline draft.
 */
async function rewriteAbstract(
  context: SkillContext | null,
  outline: SurveyOutline,
  sections: SectionDraft[]
): Promise<string> {
  if (!context) return outline.abstractDraft;

  const sectionSummaries = sections.map((s) => {
    const body = s.content.replace(/^##[^\n]*\n+/, '').split('\n\n')[0] || '';
    return `- ${s.title}: ${body.slice(0, 200)}...`;
  }).join('\n');

  const prompt = `Rewrite the abstract for a survey titled "${outline.title}".

Original draft abstract:
${outline.abstractDraft}

Actual section content summaries:
${sectionSummaries}

Requirements:
- 150-250 words
- Summarize the survey's scope, methodology, key findings, and contributions
- Be specific about which systems, benchmarks, or methods are covered
- End with a sentence about open challenges or future implications
- Do NOT include citations [N]
- Do NOT include headings or keywords
- Return ONLY the abstract text`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You write concise, specific survey abstracts.' },
      { role: 'user', content: prompt }
    ]);
    const content = normalizeText(response.content);
    if (content && content.length > 100) return content;
  } catch {
    // Fall through to original
  }
  return outline.abstractDraft;
}

/**
 * W3: Generate an Introduction section that provides context and roadmap.
 */
async function generateIntroduction(
  context: SkillContext | null,
  outline: SurveyOutline,
  sections: SectionDraft[],
  totalPaperCount?: number
): Promise<string> {
  if (!context) {
    return generateFallbackIntroduction(outline, sections.map((s) => s.title));
  }

  const sectionTitles = sections.map((s) => s.title).join(', ');

  const sectionBriefs = sections.map((s) => {
    const body = s.content.replace(/^##[^\n]*\n+/, '').split('\n\n')[0] || '';
    return `- ${s.title}: ${body.slice(0, 150)}...`;
  }).join('\n');

  // Compute survey-level meta information for richer introduction
  const allEvidenceCards = sections.flatMap((s) => s.evidenceCards || []);
  const years = allEvidenceCards.map((c) => c.year).filter((y): y is number => typeof y === 'number' && y > 0);
  const yearRange = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : 'recent years';
  const methodCategories = new Set(allEvidenceCards.flatMap((c) => c.paperTypeSignals || []));
  const categoryList = Array.from(methodCategories).slice(0, 6).join(', ') || 'various approaches';
  const paperCountStr = totalPaperCount ? `${totalPaperCount} papers` : `${allEvidenceCards.length} evidence sources`;

  const prompt = `Write an Introduction section (## Introduction) for a survey titled "${outline.title}".

The survey has these sections: ${sectionTitles}

Survey-level meta information:
- This survey covers ${paperCountStr} published between ${yearRange}
- Method categories represented: ${categoryList}
- Number of sections: ${sections.length}

Section content summaries:
${sectionBriefs}

Requirements:
- Start with "## Introduction"
- 600-1000 words (this is a substantial section, NOT a brief paragraph)
- Structure the introduction as follows:

(a) **Background** (1-2 paragraphs): Motivate the topic — why is it important now? What recent developments make this survey timely? Describe the broader context and practical significance.

(b) **Motivation and Gaps** (1 paragraph): What gaps exist in the current literature? Why is a new survey needed? What does this survey offer that prior surveys do not?

(c) **Contributions** (bulleted list): State 3-5 specific contributions of this survey. Use a bulleted list format:
- We provide a comprehensive taxonomy of ...
- We systematically compare ...
- We identify key open challenges ...

(d) **Section Roadmap** (1 paragraph): Describe the organization. "The remainder of this survey is organized as follows. Section 2 covers..., Section 3 examines..., ..." Map each section number to its title and a one-sentence description.

- Do NOT include citations [N]
- Do NOT overlap with the abstract — the introduction should complement it
- Return ONLY the markdown section`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You write concise survey introductions.' },
      { role: 'user', content: prompt }
    ]);
    let content = normalizeText(response.content);
    if (content && content.length > 100) {
      if (!content.startsWith('## ')) {
        content = `## Introduction\n\n${content}`;
      }
      // B5: Validate introduction has required structural components
      const hasContributions = /\b(contribut|we provide|we systematically|we identify|we present|we survey)\b/i.test(content);
      const hasRoadmap = /\b(remainder|organized as follows|section \d|the rest of)\b/i.test(content);
      const wordCount = content.split(/\s+/).length;
      if (wordCount >= 200 && (hasContributions || hasRoadmap)) {
        return content;
      }
    }
  } catch {
    // Fall through to template
  }
  return generateFallbackIntroduction(outline, sections.map((s) => s.title));
}

/**
 * W2: Add transition sentences at the start of each section (except the first)
 * to create flow between consecutive sections.
 */
async function addSectionTransitions(
  context: SkillContext | null,
  sections: SectionDraft[]
): Promise<SectionDraft[]> {
  if (!context || sections.length < 2) return sections;

  const result = [sections[0]];

  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1];
    const curr = sections[i];

    try {
      // Get the first paragraph after the heading to avoid redundancy
      const firstPara = curr.content.replace(/^## [^\n]+\n+/, '').split('\n\n')[0] || '';
      const prompt = `Write ONE transition sentence (20-35 words) connecting a section titled "${prev.title}" to a section titled "${curr.title}" in an academic survey.

The FIRST paragraph of the next section begins: "${firstPara.slice(0, 150)}..."

Requirements:
- Bridge from the previous section's topic to this section's topic
- Do NOT repeat the first paragraph's opening — complement it
- Academic tone, no citations [N]
- Return ONLY the single sentence, no quotes`;

      const response = await context.llm.chat([
        { role: 'system', content: 'You write smooth academic transitions.' },
        { role: 'user', content: prompt }
      ]);
      const transition = normalizeText(response.content);
      if (transition && transition.length > 20 && transition.length < 200) {
        // Insert transition after the ## heading
        const content = curr.content.replace(
          /^(## [^\n]+\n+)/,
          `$1${transition}\n\n`
        );
        result.push({ ...curr, content });
        continue;
      }
    } catch {
      // Fall through
    }
    result.push(curr);
  }

  return result;
}

/**
 * Embed Mermaid figure blocks at the end of matching sections.
 */
function embedMermaidFigures(sections: SectionDraft[], figures: SurveyFigure[]): SectionDraft[] {
  if (figures.length === 0) return sections;

  let figureCounter = 1; // Start at 2 if taxonomy figure exists
  const hasTaxonomy = figures.some((f) => f.sectionId === '_taxonomy');
  if (hasTaxonomy) figureCounter = 2;

  return sections.map((section) => {
    const sectionFigure = figures.find((f) => f.sectionId === section.sectionId);
    if (!sectionFigure) return section;

    const figNum = figureCounter++;
    const figBlock = `\n\n\`\`\`mermaid\n${sectionFigure.mermaidCode}\n\`\`\`\n\n*Figure ${figNum}: ${sectionFigure.caption}*`;
    return {
      ...section,
      content: section.content + figBlock
    };
  });
}

function generateFallbackIntroduction(outline: SurveyOutline, sectionTitles: string[]): string {
  const topic = outline.title.replace(/^A Survey of /i, '').replace(/^Survey on /i, '');
  const roadmap = sectionTitles.map((t, i) => `Section ${i + 2} covers ${t.toLowerCase()}`).join('. ');

  const contributions = [
    `We provide a comprehensive taxonomy of ${topic.toLowerCase()}, organizing the field into coherent methodological families and application domains.`,
    `We systematically compare representative systems, benchmarks, and evaluation paradigms across the surveyed literature.`,
    `We identify key open challenges and propose concrete future research directions grounded in the current evidence.`
  ].map((c) => `- ${c}`).join('\n');

  return `## Introduction

The rapid advancement of ${topic.toLowerCase()} has created both unprecedented opportunities and significant challenges across multiple domains. Recent breakthroughs in this area have attracted growing attention from both academia and industry, making a comprehensive survey both timely and necessary.

Despite the proliferation of individual studies, there remains a lack of structured synthesis that maps the current landscape, compares competing approaches, and identifies critical gaps. Existing surveys, where available, often focus on narrow sub-problems without addressing the full scope of ${topic.toLowerCase()}. This survey aims to fill that gap by providing a thorough, multi-faceted analysis.

The main contributions of this survey are as follows:

${contributions}

The remainder of this survey is organized as follows. ${roadmap}. We conclude with a discussion of open challenges and promising future directions.

Our goal is to offer researchers and practitioners a thorough yet accessible overview that highlights both achievements and limitations, enabling informed decisions about research priorities and system design.`;
}

/**
 * A6: Generate a systematic survey methodology section describing search strategy,
 * inclusion/exclusion criteria, and paper selection process.
 */
function generateMethodologySection(outline: SurveyOutline, papers: Paper[]): string {
  const years = papers.map((p) => p.year).filter((y): y is number => y > 0);
  const yearRange = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : 'recent years';
  const sources = new Set(papers.map((p) => p.source).filter(Boolean));
  const sourceList = Array.from(sources).map((s) => {
    switch (s) {
      case 'arxiv': return 'arXiv';
      case 'openalex': return 'OpenAlex';
      case 'semanticscholar': return 'Semantic Scholar';
      default: return s;
    }
  }).join(', ') || 'academic search engines';

  const topicTerms = outline.topicProfile?.anchorTerms?.slice(0, 5).join(', ') || outline.title;
  const sectionCount = outline.sections.length;

  return `## Survey Methodology

This survey follows a systematic search-and-synthesis methodology to ensure comprehensive coverage of the relevant literature.

**Search Strategy.** We queried ${sourceList} using topic-specific search terms derived from the core concepts: ${topicTerms}. For each of the ${sectionCount} survey sections, we constructed section-aware queries combining the survey topic with section-specific facets (e.g., methods, benchmarks, applications). We applied citation-graph expansion (snowball sampling) to discover additional relevant works cited by or citing the initially retrieved papers.

**Inclusion and Exclusion Criteria.** Papers were included if they (1) directly address the survey topic as indicated by title and abstract relevance, (2) were published in peer-reviewed venues or established preprint repositories, and (3) fall within the publication window of ${yearRange}. Papers were excluded if they (1) belong to unrelated application domains despite superficial keyword overlap, or (2) lack sufficient methodological or empirical content to support synthesis claims.

**Paper Selection and Assignment.** Retrieved papers were deduplicated using DOI, arXiv ID, and normalized title matching. Each paper was scored for section relevance using anchor-term coverage, paper-type signals, and topic purity filters. Papers were assigned to sections based on their highest relevance scores, with cross-section diversity penalties to minimize redundant coverage. A total of ${papers.length} unique papers were included in the final survey.`;
}

const OVERUSE_THRESHOLD = 4;
const TRACKED_ACADEMIC_VERBS = [
  'demonstrates', 'highlights', 'underscores', 'illustrates', 'reveals',
  'showcases', 'emphasizes', 'indicates', 'suggests', 'presents',
  'leverages', 'utilizes', 'facilitates', 'enables', 'addresses'
];

function checkVocabularyDiversity(text: string): string[] {
  const lower = text.toLowerCase();
  return TRACKED_ACADEMIC_VERBS.filter((verb) => {
    const matches = lower.match(new RegExp(`\\b${verb}\\b`, 'g'));
    return matches && matches.length > OVERUSE_THRESHOLD;
  }).map((verb) => {
    const count = (lower.match(new RegExp(`\\b${verb}\\b`, 'g')) || []).length;
    return `${verb} (${count}×)`;
  });
}

export async function assembleSurvey(
  outline: SurveyOutline,
  sections: SectionDraft[],
  papers: Paper[],
  qualityReport: SurveyQualityReport,
  context?: SkillContext,
  figures?: SurveyFigure[]
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
    .map((paper, index) => formatReference(paper, index + 1))
    .join('\n');

  const conclusion = await generateConclusion(context || null, outline, cleanedSections);

  // W1: Rewrite abstract based on actual section content (not the outline draft)
  const abstractText = await rewriteAbstract(context || null, outline, cleanedSections);

  // W3: Generate introduction section with survey-level meta info
  const introduction = await generateIntroduction(context || null, outline, cleanedSections, finalPapers.length);

  // A6: Generate survey methodology section
  const methodology = generateMethodologySection(outline, finalPapers);

  // W2: Add transition sentences between consecutive sections
  const transitionedSections = await addSectionTransitions(context || null, cleanedSections);

  // Embed Mermaid figures into markdown sections
  const figuredSections = embedMermaidFigures(transitionedSections, figures || []);

  // Embed taxonomy as a compact paragraph in the abstract footer rather than a standalone section
  const taxonomyLine = outline.taxonomy.length > 0
    ? `\n\n**Keywords**: ${outline.taxonomy.join(', ')}`
    : '';

  // Taxonomy figure (if available) goes after introduction
  const taxonomyFigureMd = figures?.find((f) => f.sectionId === '_taxonomy');
  const taxonomyBlock = taxonomyFigureMd
    ? `\`\`\`mermaid\n${taxonomyFigureMd.mermaidCode}\n\`\`\`\n\n*Figure 1: ${taxonomyFigureMd.caption}*`
    : '';

  const markdownParts = [
    `# ${outline.title}`,
    '## Abstract',
    abstractText + taxonomyLine,
    introduction,
    taxonomyBlock,
    methodology,
    ...figuredSections.map((section) => section.content),
    conclusion,
    '## References',
    references
  ].filter(Boolean);

  // Final ghost-citation strip on the fully assembled markdown
  // (catches citations introduced by LLM conclusion or rewrite that escaped per-section strip)
  let markdown = stripGhostCitations(markdownParts.join('\n\n'), referenceCount);

  // Vocabulary diversity check: detect overused academic verbs
  const vocabIssues = checkVocabularyDiversity(markdown);
  if (vocabIssues.length > 0 && context) {
    context.log('thinking', `Vocabulary diversity warning: overused verbs — ${vocabIssues.join(', ')}`);
  }

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
    latex = convertToLatex(outline, surveyForLatex, finalPapers, figures);
  } catch {
    // LaTeX generation is non-critical; continue without it
  }

  return {
    title: outline.title,
    markdown,
    latex,
    sections: cleanedSections,
    figures: figures && figures.length > 0 ? figures : undefined,
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
