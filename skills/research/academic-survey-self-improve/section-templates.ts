import type { OutlineSection, SectionTemplateKind, TopicProfile } from './types.js';

export interface SectionWritingTemplate {
  kind: SectionTemplateKind;
  label: string;
  rhetoricalGoal: string;
  requiredMoves: string[];
  synthesisFocus: string[];
  citationGuidance: string[];
  antiPatterns: string[];
  closingMove: string;
  tableGuidance?: string;
}

const TEMPLATE_MAP: Record<SectionTemplateKind, SectionWritingTemplate> = {
  background: {
    kind: 'background',
    label: 'Background and Scope',
    rhetoricalGoal: 'Define the field boundary, terminology, and motivating problem setting before moving into methods or systems.',
    requiredMoves: [
      'Start by defining what the topic includes and what it excludes.',
      'Explain why the topic matters now by identifying practical or scientific bottlenecks.',
      'Synthesize how survey/review papers frame the space instead of listing papers chronologically.'
    ],
    synthesisFocus: [
      'scope and terminology',
      'problem framing',
      'historical or conceptual trajectory'
    ],
    citationGuidance: [
      'Prefer survey, review, perspective, or overview evidence when available.',
      'Use citations to support definitions, scope claims, and the stated motivation for the field.'
    ],
    antiPatterns: [
      'Do not turn the section into a methods catalog.',
      'Do not spend most of the section on benchmark details.'
    ],
    closingMove: 'End by stating the conceptual boundary or open framing question that motivates the next methods-focused section.'
  },
  methods: {
    kind: 'methods',
    label: 'Core Methods',
    rhetoricalGoal: 'Organize the main methodological families, compare their assumptions, and explain the tradeoffs between them.',
    requiredMoves: [
      'Group methods into 2-4 coherent families rather than describing papers one by one.',
      'Explain what differentiates these families in architecture, planning, reasoning, or tool use.',
      'State at least one tradeoff or limitation across the method families.'
    ],
    synthesisFocus: [
      'method families',
      'architectural differences',
      'reasoning / planning / tool-use tradeoffs'
    ],
    citationGuidance: [
      'Prefer framework, architecture, workflow, and methods evidence.',
      'Use citations to support each family and the claimed tradeoffs.'
    ],
    antiPatterns: [
      'Do not write a generic background section.',
      'Do not collapse the section into a loose list of systems without methodological comparison.'
    ],
    closingMove: 'End by identifying which methodological uncertainty carries over into evaluation or deployment.',
    tableGuidance: 'Include a Markdown comparison table of representative methods with at least 6 rows (columns: Method/System, Year, Category, Key Technique, Dataset/Benchmark, Strengths, Limitations). Each row should correspond to a distinct approach from the evidence cards.'
  },
  benchmark: {
    kind: 'benchmark',
    label: 'Evaluation and Benchmarks',
    rhetoricalGoal: 'Explain how the field is evaluated, what metrics or datasets dominate, and where the current evaluation regime is insufficient.',
    requiredMoves: [
      'Identify the main benchmark, dataset, metric, or evaluation paradigms used in this area.',
      'Compare what different evaluation setups actually measure.',
      'State at least one gap, blind spot, or benchmarking limitation.'
    ],
    synthesisFocus: [
      'benchmark coverage',
      'metrics and datasets',
      'evaluation blind spots'
    ],
    citationGuidance: [
      'Prefer benchmark, evaluation, dataset, leaderboard, or ablation evidence.',
      'When possible, contrast at least two evaluation approaches instead of reporting a single result.'
    ],
    antiPatterns: [
      'Do not drift into a generic methods summary.',
      'Do not claim strong performance without tying it to an explicit benchmark or metric.',
      'Do not ignore what current evaluations fail to capture.'
    ],
    closingMove: 'End by stating which benchmark gap or evaluation blind spot limits confidence in the field today.',
    tableGuidance: 'Include a Markdown comparison table summarizing key benchmarks/datasets with at least 5 rows (columns: Name, Year, Task Types, Scale, Key Metric, Evaluation Focus, Limitation).'
  },
  systems: {
    kind: 'systems',
    label: 'Applications and Systems',
    rhetoricalGoal: 'Describe representative end-to-end systems or workflows and explain how architecture choices shape practical capability.',
    requiredMoves: [
      'Select representative systems, platforms, or workflows rather than abstract methods only.',
      'Explain how system-level components interact across the research pipeline.',
      'Highlight one concrete deployment or integration tradeoff.'
    ],
    synthesisFocus: [
      'end-to-end system composition',
      'workflow orchestration',
      'deployment or integration tradeoffs'
    ],
    citationGuidance: [
      'Prefer system, platform, workflow, application, and deployment evidence.',
      'Use citations when attributing system capabilities, architecture, or deployment claims.'
    ],
    antiPatterns: [
      'Do not reduce the section to abstract method families.',
      'Do not describe applications without clarifying how the full system is organized.'
    ],
    closingMove: 'End by stating what system-level capability remains hard to achieve in practical deployment.',
    tableGuidance: 'Include a Markdown comparison table of representative systems with at least 5 rows (columns: System, Year, Architecture, Key Capability, Domain, Limitation).'
  },
  challenges: {
    kind: 'challenges',
    label: 'Open Challenges and Future Directions',
    rhetoricalGoal: 'Synthesize unresolved technical, scientific, or governance problems and explain why they remain difficult.',
    requiredMoves: [
      'Identify the main unresolved limitations or failure modes in the literature.',
      'Separate near-term engineering issues from deeper open research questions when possible.',
      'Point to a concrete future direction supported by the evidence.'
    ],
    synthesisFocus: [
      'limitations and failure modes',
      'research gaps',
      'future directions'
    ],
    citationGuidance: [
      'Prefer challenge, limitation, ethics, reliability, or future-work evidence.',
      'Use citations to ground claims about unresolved problems and proposed future directions.'
    ],
    antiPatterns: [
      'Do not repeat the full methods section.',
      'Do not present vague optimism without identifying concrete unresolved issues.'
    ],
    closingMove: 'End with a concise research agenda statement tied back to the surveyed evidence.'
  },
  generic: {
    kind: 'generic',
    label: 'General Survey Section',
    rhetoricalGoal: 'Provide a focused synthesis of the evidence for this section.',
    requiredMoves: [
      'Synthesize multiple evidence cards rather than listing papers individually.',
      'Make the section-specific focus explicit.',
      'State one unresolved issue that remains after the synthesis.'
    ],
    synthesisFocus: [
      'section-specific synthesis',
      'comparison across evidence'
    ],
    citationGuidance: [
      'Use inline citations for every substantive claim.',
      'Prefer citing multiple evidence cards when they support a synthesis claim.'
    ],
    antiPatterns: [
      'Do not list papers sequentially without synthesis.',
      'Do not introduce claims absent from the evidence cards.'
    ],
    closingMove: 'End by stating what remains unresolved in this section.'
  }
};

export function resolveSectionWritingTemplate(
  section: OutlineSection,
  topicProfile?: TopicProfile
): SectionWritingTemplate {
  const kind = classifySectionTemplateKind(section, topicProfile);
  return TEMPLATE_MAP[kind];
}

export function getSectionWritingTemplate(kind: SectionTemplateKind): SectionWritingTemplate {
  return TEMPLATE_MAP[kind];
}

export function classifySectionTemplateKind(
  section: OutlineSection,
  topicProfile?: TopicProfile
): SectionTemplateKind {
  const title = section.title.toLowerCase();
  const description = (section.description || '').toLowerCase();
  const facets = [
    ...(section.focusFacets || []),
    ...((topicProfile?.sectionFacets?.[section.id]) || [])
  ].map((item) => String(item).toLowerCase());

  const haystack = `${title} ${description} ${facets.join(' ')}`;

  if (/\b(background|scope|problem setting|motivation|overview)\b/.test(haystack)) {
    return 'background';
  }

  if (/\b(benchmark|evaluation|metric|dataset|leaderboard)\b/.test(haystack)) {
    return 'benchmark';
  }

  if (/\b(system|systems|application|applications|platform|deployment|workflow|orchestration)\b/.test(haystack)) {
    return 'systems';
  }

  if (/\b(challenge|challenges|future|limitations|ethic|reliability|open problem)\b/.test(haystack)) {
    return 'challenges';
  }

  if (/\b(method|methods|architecture|framework|planning|reasoning|tool)\b/.test(haystack)) {
    return 'methods';
  }

  return 'generic';
}
