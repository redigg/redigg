import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyOutline } from './types.js';
import { alignClaimsToEvidence, buildEvidenceCards, normalizeText, parseJsonObject } from './utils.js';

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

    const prompt = `
[SURVEY_SECTION_DRAFT]
Topic: ${topic}
Section title: ${section.title}
Section goal: ${section.description}
Target word count: ${section.targetWordCount}

Evidence cards:
${evidenceCards.map((card) => {
  const focus = card.evidenceFocus.length > 0 ? card.evidenceFocus.join(', ') : 'general relevance';
  const types = card.paperTypeSignals.length > 0 ? card.paperTypeSignals.join(', ') : 'uncategorized';
  return `[${card.citation}] ${card.title} (${card.year})
- Focus: ${focus}
- Type signals: ${types}
- Key contribution: ${card.keyContribution}
- Grounded claim: ${card.groundedClaim}
- Limitation hint: ${card.limitationHint}`;
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
- Synthesize, do not list papers one by one.
- Every substantive claim must be supported by the evidence cards above.
- Use citation markers like [1], [2] when making claims.
- Mention at least two distinct evidence cards when more than one is available.
- Do not introduce systems, benchmarks, datasets, or claims that are absent from the evidence cards.
- End with one sentence stating what remains unresolved in this section.
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
    if (!content.startsWith('## ')) {
      content = `## ${section.title}\n\n${content}`;
    }

    if (!content || content === `## ${section.title}`) {
      content = createFallbackSection(section.title, section.description, evidenceCards);
    }

    const claimAlignments = alignClaimsToEvidence(content, evidenceCards, parsed?.claimMappings);

    drafts.push({
      sectionId: section.id,
      title: section.title,
      content,
      paperCount: sectionPapers.length,
      citations,
      evidenceCards,
      claimAlignments
    });
  }

  return drafts;
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
