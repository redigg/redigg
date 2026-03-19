import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyOutline } from './types.js';
import { resolveSectionWritingTemplate } from './section-templates.js';
import { alignClaimsToEvidence, buildEvidenceCards, countWords, normalizeText, parseJsonObject } from './utils.js';

interface SectionDraftResponse {
  markdown?: string;
  claimMappings?: Array<{
    claim?: string;
    citations?: number[];
  }>;
}

export async function writeSurveySections(
  context: SkillContext,
  topic: string,
  outline: SurveyOutline,
  papersBySection: Record<string, Paper[]>,
  paperIndexMap: Map<string, number>
): Promise<SectionDraft[]> {
  const drafts: SectionDraft[] = [];

  for (const section of outline.sections) {
    const sectionPapers = papersBySection[section.id] || [];
    const citations = sectionPapers
      .map((paper) => paperIndexMap.get(paper.title.toLowerCase()))
      .filter((value): value is number => typeof value === 'number');
    const evidenceCards = buildEvidenceCards(sectionPapers, citations, section, outline.topicProfile);
    const template = resolveSectionWritingTemplate(section, outline.topicProfile);

    const tableBlock = template.tableGuidance
      ? `\nTable requirement: ${template.tableGuidance}`
      : '';
    const templateBlock = `
Section template: ${template.label} (${template.kind})
Rhetorical goal: ${template.rhetoricalGoal}
Required moves:
${template.requiredMoves.map((m) => `- ${m}`).join('\n')}
Synthesis focus: ${template.synthesisFocus.join(', ')}
Citation guidance:
${template.citationGuidance.map((g) => `- ${g}`).join('\n')}
Anti-patterns to avoid:
${template.antiPatterns.map((a) => `- ${a}`).join('\n')}
Closing move: ${template.closingMove}${tableBlock}`;

    // Build sub-section plan from outline if available
    const subSections = section.subSections || [];
    let subSectionPlan = '';
    if (subSections.length > 0) {
      subSectionPlan = `\nSub-section plan (use ### headings for each):
${subSections.map((sub, i) => `${i + 1}. ### ${sub.title} (~${sub.targetWordCount} words) — ${sub.description}`).join('\n')}
Each sub-section MUST appear as a ### heading in the output. Write at least ${Math.round(subSections[0].targetWordCount * 0.8)} words per sub-section.`;
    } else if (section.targetWordCount >= 400) {
      subSectionPlan = `\nSub-heading requirement: Use 2-3 sub-headings (### level) to organize this section. Each sub-heading should cover a distinct theme, method family, or evaluation dimension. Do NOT use generic sub-headings like "Overview" or "Summary".`;
    }

    // Comparison table instruction for methods/benchmark/systems sections
    const comparisonTableInstruction = template.tableGuidance
      ? `\nComparison table requirement: ${template.tableGuidance} The table MUST use valid Markdown table syntax (| col1 | col2 | ... |). Place the table after the relevant analysis paragraph, not at the very end.`
      : '';

    const prompt = `
[SURVEY_SECTION_DRAFT]
Topic: ${topic}
Section title: ${section.title}
Section goal: ${section.description}
Target word count: ${section.targetWordCount}
${templateBlock}${subSectionPlan}${comparisonTableInstruction}

Evidence cards:
${evidenceCards.map((card) => {
  const focus = card.evidenceFocus.length > 0 ? card.evidenceFocus.join(', ') : 'general relevance';
  const types = card.paperTypeSignals.length > 0 ? card.paperTypeSignals.join(', ') : 'uncategorized';
  const quotables = card.quotableFindings.length > 0
    ? `\n- Quotable findings (YOU MAY cite these verbatim): ${card.quotableFindings.join(' | ')}`
    : '';
  return `[${card.citation}] ${card.title} (${card.year})
- Evidence level: ${card.evidenceLevel}
- Focus: ${focus}
- Type signals: ${types}
- Key contribution: ${card.keyContribution}
- Grounded claim: ${card.groundedClaim}
- Limitation hint: ${card.limitationHint}${quotables}`;
}).join('\n\n')}

Return ONLY valid JSON:
{
  "markdown": "## ${section.title}\\n\\n...",
  "claimMappings": [
    {
      "claim": "One explicit sentence-level claim copied from the markdown body.",
      "citations": [1, 2]
    }
  ]
}

Requirements for the markdown:
- Start with a level-2 heading using the exact section title.
- Follow the rhetorical goal, required moves, and closing move from the section template above.
- CRITICAL LENGTH REQUIREMENT: Write at least ${section.targetWordCount} words. Aim for ${Math.round(section.targetWordCount * 1.15)} words. Sections shorter than ${Math.round(section.targetWordCount * 0.75)} words will be REJECTED and rewritten. This is the MOST IMPORTANT requirement — short sections waste the entire generation. Plan your writing: with ${section.targetWordCount >= 800 ? '6-8' : section.targetWordCount >= 400 ? '5-7' : '3-4'} substantive paragraphs, each paragraph needs ${Math.round(section.targetWordCount / (section.targetWordCount >= 800 ? 7 : section.targetWordCount >= 400 ? 6 : 3.5))} words on average.
- Each paragraph should be 80-150 words. Do NOT write short 30-50 word paragraphs.
- Synthesize, do not list papers one by one.
- Every substantive claim must be supported by the evidence cards above.
- Use citation markers like [1], [2] when making claims.
- Mention at least two distinct evidence cards when more than one is available.
- Do not introduce systems, benchmarks, datasets, or claims that are absent from the evidence cards.
- CLAIM-SOURCE GROUNDING RULE: Every claim you attribute to a cited paper MUST be derivable from that paper's evidence card above. Do NOT claim a paper "proposes X" or "demonstrates Y" unless X or Y appears in the paper's key contribution, grounded claim, or quotable findings. If an evidence card has evidence level "perspective" or "review", do NOT cite it as empirical evidence — instead, frame it as "according to [N], ..." or "[N] argues that...".
- ABSOLUTE RULE — NEVER fabricate specific numbers, percentages, or statistics. This means:
  * Do NOT invent accuracy percentages (e.g. "achieving 89% accuracy") unless the EXACT number appears in an evidence card above.
  * Do NOT invent improvement factors (e.g. "3x faster", "4.3× improvement") unless stated verbatim in an evidence card.
  * Do NOT invent counts or ratios (e.g. "72% of tasks", "31% recall") unless in an evidence card.
  * If you need to describe performance, use qualitative language: "significantly outperforms", "shows substantial improvement", "achieves competitive results".
  * You MAY use numbers that appear in evidence card fields (keyContribution, groundedClaim, limitationHint).
- Avoid all listed anti-patterns.
- Prioritize evidence cards that are most specific to this section's theme. If a paper appears generic, give more space to papers with stronger section-specific relevance.
- CITATION LIMIT: Each sentence should cite at most 3 papers. If you need to cite more, split the claim across multiple sentences, each citing different subsets.
- TRANSITIONS: Each ### sub-section's first sentence must connect to the previous sub-section's content. Use transitional phrases like "Building on...", "In contrast to...", "While the above approaches...", "Complementing these efforts...".
- VOCABULARY DIVERSITY: Vary your vocabulary across sentences. Avoid repeating the same phrases (e.g. "demonstrates", "highlights", "underscores") more than twice. Use diverse academic verbs and sentence structures.
- Do NOT include any meta-commentary about your writing process (e.g. "This section covers...", "Word count:"). Output ONLY the academic survey text.
Requirements for claimMappings:
- Include 2-4 core sentence-level claims from the markdown body.
- Each claim must appear verbatim or near-verbatim in the markdown.
- Each claim must cite only the evidence cards used to support it.
`;

    const response = await context.llm.chat([
      { role: 'system', content: 'You write grounded academic survey sections.' },
      { role: 'user', content: prompt }
    ]);

    const parsed = parseJsonObject<SectionDraftResponse>(response.content);
    let content = normalizeText(parsed?.markdown || response.content);

    // Strip LLM meta-commentary before any further processing
    content = stripLlmArtifacts(content);

    if (!content.startsWith('## ')) {
      content = `## ${section.title}\n\n${content}`;
    }

    if (!content || content === `## ${section.title}`) {
      content = createFallbackSection(section.title, section.description, evidenceCards);
    }

    // Inline word count floor: if draft is too short, request a single expansion pass
    const draftWordCount = countWords(content);
    const minFloor = Math.round(section.targetWordCount * 0.75);
    if (draftWordCount < minFloor && draftWordCount >= 80) {
      const expandedContent = await requestExpansion(context, content, section.title, section.targetWordCount, evidenceCards);
      if (expandedContent && countWords(expandedContent) > draftWordCount) {
        content = expandedContent;
      }
    }

    const claimAlignments = alignClaimsToEvidence(content, evidenceCards, parsed?.claimMappings);

    drafts.push({
      sectionId: section.id,
      title: section.title,
      templateKind: template.kind,
      content,
      paperCount: sectionPapers.length,
      citations,
      evidenceCards,
      claimAlignments,
      targetWordCount: section.targetWordCount
    });
  }

  return drafts;
}

/**
 * Strip common LLM meta-commentary artifacts from draft section content.
 */
function stripLlmArtifacts(text: string): string {
  let cleaned = text;

  // Remove preamble lines like "Here's the revised/expanded..."
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

/**
 * Request a single expansion pass when the initial draft is below the word count floor.
 * This avoids routing through the full review cycle for a simple length issue.
 */
async function requestExpansion(
  context: SkillContext,
  currentContent: string,
  sectionTitle: string,
  targetWordCount: number,
  evidenceCards: SectionDraft['evidenceCards']
): Promise<string | null> {
  const currentWords = countWords(currentContent);
  const deficit = targetWordCount - currentWords;
  const evidenceSummary = evidenceCards
    .map((card) => `[${card.citation}] ${card.title}: ${card.groundedClaim}`)
    .join('\n');

  const prompt = `The following survey section is too short. It is currently ${currentWords} words but needs to be at least ${targetWordCount} words (deficit: ${deficit} words).

Expand the section by:
1. Adding deeper analysis paragraphs (80-150 words each)
2. Drawing on more of the available evidence cards
3. Adding comparisons between methods/approaches
4. Discussing tradeoffs and limitations

Evidence cards available:
${evidenceSummary}

Current section:
${currentContent}

Return ONLY the expanded section text. No preamble, no postamble, no meta-commentary.`;

  try {
    const response = await context.llm.chat([
      { role: 'system', content: 'You expand academic survey sections to meet word count targets. Output ONLY the expanded section text.' },
      { role: 'user', content: prompt }
    ]);
    let expanded = normalizeText(response.content);
    expanded = stripLlmArtifacts(expanded);
    if (!expanded.startsWith('## ')) {
      expanded = `## ${sectionTitle}\n\n${expanded}`;
    }
    return expanded;
  } catch {
    return null;
  }
}

function createFallbackSection(
  title: string,
  description: string,
  evidenceCards: SectionDraft['evidenceCards']
): string {
  const evidence = evidenceCards
    .map((card) => `Representative evidence includes ${card.title} (${card.year}), which shows ${card.keyContribution.toLowerCase()} [${card.citation}].`)
    .join(' ');

  return `## ${title}\n\n${description} ${evidence} The literature still leaves open questions around generalization, evaluation, and deployment trade-offs.`.trim();
}
