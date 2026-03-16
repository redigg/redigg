import type { SurveyBenchmarkCase } from './types.js';

// Use shorter canonical names so substring matching works with LLM-generated titles
// e.g. "Background" matches "Background and Scope", "Background and Motivation", etc.
const COMMON_REQUIRED_SECTIONS = [
  'Background',
  'Methods',
  'Evaluation',
  'Applications',
  'Challenges'
];

export const SURVEY_BENCHMARK_CASES: SurveyBenchmarkCase[] = [
  {
    id: 'ai-agent-scientific-research',
    topic: 'AI Agent for Scientific Research',
    depth: 'standard',
    anchorTerms: ['ai', 'agent', 'scientific', 'research'],
    requiredSections: COMMON_REQUIRED_SECTIONS,
    preferredPaperTypes: ['survey', 'benchmark', 'system', 'workflow'],
    minReferences: 8,
    minPapers: 8,
    minClaimAlignments: 5,
    minWordCount: 800
  },
  {
    id: 'llm-reasoning-deliberation',
    topic: 'LLM Reasoning and Deliberation',
    depth: 'standard',
    anchorTerms: ['llm', 'reasoning', 'deliberation'],
    requiredSections: COMMON_REQUIRED_SECTIONS,
    preferredPaperTypes: ['survey', 'benchmark', 'method'],
    minReferences: 8,
    minPapers: 8,
    minClaimAlignments: 5,
    minWordCount: 800
  },
  {
    id: 'scientific-literature-review-automation',
    topic: 'Scientific Literature Review Automation',
    depth: 'standard',
    anchorTerms: ['scientific', 'literature', 'review', 'automation'],
    requiredSections: COMMON_REQUIRED_SECTIONS,
    preferredPaperTypes: ['survey', 'system', 'workflow', 'benchmark'],
    minReferences: 8,
    minPapers: 8,
    minClaimAlignments: 5,
    minWordCount: 800
  },
  {
    id: 'autonomous-materials-discovery',
    topic: 'Autonomous Materials Discovery with AI Agents',
    depth: 'standard',
    anchorTerms: ['autonomous', 'materials', 'discovery', 'agent'],
    requiredSections: COMMON_REQUIRED_SECTIONS,
    preferredPaperTypes: ['system', 'workflow', 'benchmark', 'application'],
    minReferences: 8,
    minPapers: 8,
    minClaimAlignments: 5,
    minWordCount: 800
  },
  {
    id: 'multi-agent-scientific-discovery',
    topic: 'Multi-Agent Scientific Discovery Systems',
    depth: 'standard',
    anchorTerms: ['multi-agent', 'scientific', 'discovery', 'systems'],
    requiredSections: COMMON_REQUIRED_SECTIONS,
    preferredPaperTypes: ['system', 'workflow', 'benchmark', 'survey'],
    minReferences: 8,
    minPapers: 8,
    minClaimAlignments: 5,
    minWordCount: 800
  }
];

export function selectBenchmarkCases(ids?: string[]): SurveyBenchmarkCase[] {
  if (!ids || ids.length === 0) {
    return SURVEY_BENCHMARK_CASES;
  }

  const idSet = new Set(ids);
  return SURVEY_BENCHMARK_CASES.filter((item) => idSet.has(item.id));
}
