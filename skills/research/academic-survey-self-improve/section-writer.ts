import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyOutline } from './types.js';
import { buildEvidenceCards, normalizeText } from './utils.js';

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

Write a concise academic survey subsection in Markdown.
Requirements:
- Start with a level-2 heading using the exact section title.
- Synthesize, do not list papers one by one.
- Every substantive claim must be supported by the evidence cards above.
- Use citation markers like [1], [2] when making claims.
- Mention at least two distinct evidence cards when more than one is available.
- Do not introduce systems, benchmarks, datasets, or claims that are absent from the evidence cards.
- End with one sentence stating what remains unresolved in this section.
`;

    const response = await context.llm.chat([
      { role: 'system', content: 'You write grounded academic survey sections.' },
      { role: 'user', content: prompt }
    ]);

    let content = normalizeText(response.content);
    if (!content.startsWith('## ')) {
      content = `## ${section.title}\n\n${content}`;
    }

    if (!content || content === `## ${section.title}`) {
      content = createFallbackSection(section.title, section.description, evidenceCards);
    }

    drafts.push({
      sectionId: section.id,
      title: section.title,
      content,
      paperCount: sectionPapers.length,
      citations,
      evidenceCards
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
