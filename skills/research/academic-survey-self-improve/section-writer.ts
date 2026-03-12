import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { SectionDraft, SurveyOutline } from './types.js';
import { normalizeText } from './utils.js';

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

    const prompt = `
[SURVEY_SECTION_DRAFT]
Topic: ${topic}
Section title: ${section.title}
Section goal: ${section.description}
Target word count: ${section.targetWordCount}

Available evidence:
${sectionPapers.map((paper, index) => {
  const citationNumber = citations[index] ?? index + 1;
  return `[${citationNumber}] ${paper.title} (${paper.year})\nSummary: ${paper.summary}`;
}).join('\n\n')}

Write a concise academic survey subsection in Markdown.
Requirements:
- Start with a level-2 heading using the exact section title.
- Synthesize, do not list papers one by one.
- Use citation markers like [1], [2] when making claims.
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
      content = createFallbackSection(section.title, section.description, sectionPapers, citations);
    }

    drafts.push({
      sectionId: section.id,
      title: section.title,
      content,
      paperCount: sectionPapers.length,
      citations
    });
  }

  return drafts;
}

function createFallbackSection(
  title: string,
  description: string,
  papers: Paper[],
  citations: number[]
): string {
  const evidence = papers
    .map((paper, index) => `Representative evidence includes ${paper.title} (${paper.year}), which highlights ${paper.summary.toLowerCase()} [${citations[index] ?? index + 1}].`)
    .join(' ');

  return `## ${title}\n\n${description} ${evidence} The literature still leaves open questions around generalization, evaluation, and deployment trade-offs.`.trim();
}
