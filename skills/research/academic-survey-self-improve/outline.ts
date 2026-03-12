import type { Paper } from '../../../src/skills/lib/ScholarTool.js';
import type { SkillContext } from '../../../src/skills/types.js';
import type { OutlineSection, SurveyOutline } from './types.js';
import { parseJsonObject, slugify } from './utils.js';

const DEPTH_SECTION_COUNT: Record<string, number> = {
  brief: 3,
  standard: 4,
  deep: 5
};

export async function createSurveyOutline(
  context: SkillContext,
  topic: string,
  seedPapers: Paper[],
  depth: string
): Promise<SurveyOutline> {
  const fallback = createFallbackOutline(topic, depth, seedPapers);
  const papersText = seedPapers
    .slice(0, 6)
    .map((paper, index) => `${index + 1}. ${paper.title} (${paper.year}) - ${paper.summary}`)
    .join('\n');

  const prompt = `
[SURVEY_OUTLINE_REQUEST]
You are designing a survey outline for the topic: "${topic}".
Depth: ${depth}
Seed papers:
${papersText}

Return ONLY valid JSON with the following schema:
{
  "title": "string",
  "abstractDraft": "string",
  "taxonomy": ["string"],
  "sections": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "searchQueries": ["string", "string"],
      "targetWordCount": 180
    }
  ]
}

Constraints:
- ${DEPTH_SECTION_COUNT[depth] || DEPTH_SECTION_COUNT.standard} sections.
- Cover problem setting, methods, evaluation, and open problems when possible.
- searchQueries must be concrete literature-search queries.
`;

  const response = await context.llm.chat([
    { role: 'system', content: 'You design structured academic survey outlines.' },
    { role: 'user', content: prompt }
  ]);

  const parsed = parseJsonObject<Partial<SurveyOutline>>(response.content);
  return normalizeOutline(parsed, fallback, topic, depth);
}

function createFallbackOutline(topic: string, depth: string, seedPapers: Paper[]): SurveyOutline {
  const sectionCount = DEPTH_SECTION_COUNT[depth] || DEPTH_SECTION_COUNT.standard;
  const baseSections: OutlineSection[] = [
    {
      id: 'background-and-scope',
      title: 'Background and Scope',
      description: `Define the scope, terminology, and problem setting for ${topic}.`,
      searchQueries: [topic, `${topic} overview`, `${topic} survey`],
      targetWordCount: 220
    },
    {
      id: 'core-methods',
      title: 'Core Methods',
      description: `Summarize the main methodological families used in ${topic}.`,
      searchQueries: [`${topic} methods`, `${topic} framework`, `${topic} model`],
      targetWordCount: 260
    },
    {
      id: 'evaluation-and-benchmarks',
      title: 'Evaluation and Benchmarks',
      description: `Compare datasets, metrics, and empirical findings for ${topic}.`,
      searchQueries: [`${topic} benchmark`, `${topic} evaluation`, `${topic} dataset`],
      targetWordCount: 220
    },
    {
      id: 'applications-and-systems',
      title: 'Applications and Systems',
      description: `Summarize representative systems and application settings for ${topic}.`,
      searchQueries: [`${topic} applications`, `${topic} system`, `${topic} deployment`],
      targetWordCount: 220
    },
    {
      id: 'open-challenges',
      title: 'Open Challenges and Future Directions',
      description: `Identify limitations, open challenges, and future directions for ${topic}.`,
      searchQueries: [`${topic} limitations`, `${topic} challenges`, `${topic} future directions`],
      targetWordCount: 220
    }
  ];

  const selectedSections = baseSections.slice(0, sectionCount).map((section, index) => ({
    ...section,
    id: `${slugify(section.id || section.title)}-${index + 1}`
  }));

  return {
    title: `A Survey of ${topic}`,
    abstractDraft: `This survey reviews ${topic} by organizing representative literature into a concise taxonomy, summarizing core methods, evaluation practices, and open research challenges.`,
    taxonomy: seedPapers.length > 0
      ? seedPapers.slice(0, Math.min(3, seedPapers.length)).map((paper) => paper.title)
      : ['Problem Setting', 'Methods', 'Evaluation'],
    sections: selectedSections
  };
}

function normalizeOutline(
  parsed: Partial<SurveyOutline> | null,
  fallback: SurveyOutline,
  topic: string,
  depth: string
): SurveyOutline {
  if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    return fallback;
  }

  const sectionCount = DEPTH_SECTION_COUNT[depth] || DEPTH_SECTION_COUNT.standard;
  const sections = parsed.sections.slice(0, sectionCount).map((section, index) => ({
    id: slugify(section?.id || section?.title || `section-${index + 1}`),
    title: section?.title?.trim() || fallback.sections[index]?.title || `Section ${index + 1}`,
    description: section?.description?.trim() || fallback.sections[index]?.description || `Discuss ${topic}.`,
    searchQueries: Array.isArray(section?.searchQueries) && section.searchQueries.length > 0
      ? section.searchQueries.map((query) => String(query).trim()).filter(Boolean)
      : fallback.sections[index]?.searchQueries || [topic],
    targetWordCount: Number(section?.targetWordCount) > 0
      ? Number(section?.targetWordCount)
      : fallback.sections[index]?.targetWordCount || 220
  }));

  return {
    title: parsed.title?.trim() || fallback.title,
    abstractDraft: parsed.abstractDraft?.trim() || fallback.abstractDraft,
    taxonomy: Array.isArray(parsed.taxonomy) && parsed.taxonomy.length > 0
      ? parsed.taxonomy.map((item) => String(item).trim()).filter(Boolean)
      : fallback.taxonomy,
    sections
  };
}
