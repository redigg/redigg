import fs from 'fs';
import type { SkillResult } from '../../skills/types.js';
import type { Paper } from '../../skills/lib/ScholarTool.js';
import type {
  BenchmarkMetric,
  SurveyBenchmarkCase,
  SurveyBenchmarkTopicScorecard
} from './types.js';

interface BenchmarkArtifacts {
  pdfPath?: string;
  externalQa?: {
    score: number;
    passed: boolean;
  };
}

type SectionIntent = 'background' | 'methods' | 'evaluation' | 'applications' | 'challenges' | 'generic';

const PAPER_TYPE_ALIASES: Record<string, string> = {
  application: 'application',
  applications: 'application',
  architecture: 'architecture',
  benchmark: 'benchmark',
  benchmarks: 'benchmark',
  challenge: 'challenges',
  challenges: 'challenges',
  evaluation: 'evaluation',
  evaluations: 'evaluation',
  framework: 'framework',
  method: 'methods',
  methods: 'methods',
  survey: 'survey',
  surveys: 'survey',
  system: 'system',
  systems: 'system',
  workflow: 'workflow',
  workflows: 'workflow'
};

const FOREIGN_DOMAIN_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  { name: 'legal', keywords: ['legal', 'law', 'court', 'judicial'] },
  { name: 'healthcare', keywords: ['healthcare', 'medical', 'clinical', 'patient', 'diagnosis'] },
  { name: 'finance', keywords: ['finance', 'financial', 'banking', 'trading'] },
  { name: 'robotics', keywords: ['robot', 'robotics', 'manipulation'] },
  { name: 'education', keywords: ['education', 'classroom', 'student', 'pedagog'] }
];

function clampScore(value: number, maxScore = 100): number {
  return Math.max(0, Math.min(maxScore, Math.round(value)));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizePaperTypeSignal(signal: string): string {
  const normalized = normalizeText(String(signal || ''));
  return PAPER_TYPE_ALIASES[normalized] || normalized;
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function includesSection(actualSections: string[], expectedSection: string): boolean {
  const expected = normalizeText(expectedSection);
  return actualSections.some((title) => normalizeText(title).includes(expected));
}

function extractInlineCitations(markdown: string): number[] {
  const matches = [...markdown.matchAll(/\[(\d+)\]/g)];
  return matches.map((match) => Number(match[1])).filter(Number.isFinite);
}

function inferReferenceCount(result: SkillResult): number {
  return Array.isArray(result.papers) ? result.papers.length : 0;
}

function inferPaperTypeCoverage(result: SkillResult): Set<string> {
  const paperTypes = new Set<string>();
  const sections = Array.isArray(result.sections) ? result.sections : [];

  for (const section of sections) {
    const evidenceCards = Array.isArray(section.evidenceCards) ? section.evidenceCards : [];
    for (const evidence of evidenceCards) {
      const signals = Array.isArray(evidence.paperTypeSignals) ? evidence.paperTypeSignals : [];
      for (const signal of signals) {
        paperTypes.add(normalizePaperTypeSignal(signal));
      }
    }
  }

  return paperTypes;
}

function inferClaimAlignmentCount(result: SkillResult): number {
  const sections = Array.isArray(result.sections) ? result.sections : [];
  return sections.reduce((count: number, section: any) => {
    const alignments = Array.isArray(section.claimAlignments) ? section.claimAlignments : [];
    return count + alignments.length;
  }, 0);
}

function inferSectionIntent(sectionTitle: string): SectionIntent {
  const normalized = normalizeText(sectionTitle);

  if (/\b(background|scope|motivation|problem|setting|overview|introduction)\b/.test(normalized)) {
    return 'background';
  }
  if (/\b(method|methods|approach|approaches|framework|frameworks|architecture|architectures|reasoning)\b/.test(normalized)) {
    return 'methods';
  }
  if (/\b(evaluation|evaluations|benchmark|benchmarks|assessment)\b/.test(normalized)) {
    return 'evaluation';
  }
  if (/\b(application|applications|system|systems|case|cases|domain)\b/.test(normalized)) {
    return 'applications';
  }
  if (/\b(challenge|challenges|open problem|future direction|limitation|limitations)\b/.test(normalized)) {
    return 'challenges';
  }

  return 'generic';
}

function sectionSupportsIntent(intent: SectionIntent, normalizedSignals: Set<string>): boolean {
  if (intent === 'background') {
    return normalizedSignals.has('survey') || normalizedSignals.has('benchmark') || normalizedSignals.has('evaluation');
  }
  if (intent === 'methods') {
    return ['methods', 'workflow', 'system', 'framework', 'architecture'].some((signal) => normalizedSignals.has(signal));
  }
  if (intent === 'evaluation') {
    return normalizedSignals.has('benchmark') || normalizedSignals.has('evaluation');
  }
  if (intent === 'applications') {
    return ['application', 'system', 'workflow'].some((signal) => normalizedSignals.has(signal));
  }
  if (intent === 'challenges') {
    return normalizedSignals.has('challenges') || normalizedSignals.has('survey');
  }

  return normalizedSignals.size > 0;
}

function sectionText(section: any): string {
  const evidenceCards = Array.isArray(section?.evidenceCards) ? section.evidenceCards : [];
  const evidenceText = evidenceCards.map((card: any) =>
    [card.title, card.groundedClaim, card.keyContribution, card.limitationHint].filter(Boolean).join(' ')
  );

  return [
    section?.title,
    section?.content,
    ...evidenceText
  ]
    .filter(Boolean)
    .join(' ');
}

function countAnchorMatches(text: string, anchorTerms: string[]): number {
  const normalized = ` ${normalizeText(text)} `;
  const matchedAnchors = new Set<string>();

  for (const anchorTerm of anchorTerms) {
    const normalizedAnchor = normalizeText(anchorTerm);
    if (!normalizedAnchor) continue;
    if (normalized.includes(` ${normalizedAnchor} `)) {
      matchedAnchors.add(normalizedAnchor);
    }
  }

  return matchedAnchors.size;
}

function detectForeignDomains(text: string, benchmarkCase: SurveyBenchmarkCase): string[] {
  const normalizedText = normalizeText(text);
  const topicText = normalizeText([benchmarkCase.topic, ...benchmarkCase.anchorTerms].join(' '));
  const detected: string[] = [];

  for (const domain of FOREIGN_DOMAIN_KEYWORDS) {
    const topicAlreadyIncludesDomain = domain.keywords.some((keyword) => topicText.includes(normalizeText(keyword)));
    if (topicAlreadyIncludesDomain) {
      continue;
    }

    if (domain.keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)))) {
      detected.push(domain.name);
    }
  }

  return detected;
}

function preferredTypeSatisfied(paperTypeCoverage: Set<string>, preferredType: string): boolean {
  const normalizedPreferredType = normalizePaperTypeSignal(preferredType);

  if (normalizedPreferredType === 'methods') {
    return ['methods', 'workflow', 'system', 'framework', 'architecture'].some((type) => paperTypeCoverage.has(type));
  }

  return paperTypeCoverage.has(normalizedPreferredType);
}

// ── Structure ──────────────────────────────────────────────────────────

function scoreStructure(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  const actualSections = Array.isArray(result.sections) ? result.sections.map((section: any) => section.title) : [];
  const markdown = String(result.formatted_output || result.summary || '');
  let score = 0;

  // Title (10)
  const hasTitle = typeof result.outline?.title === 'string' && result.outline.title.trim().length > 0;
  if (hasTitle) {
    score += 10;
    details.push('包含 survey 标题');
  } else {
    details.push('缺少 survey 标题');
  }

  // Abstract (10)
  const hasAbstract = markdown.includes('## Abstract');
  if (hasAbstract) {
    score += 10;
    details.push('包含 Abstract');
  } else {
    details.push('缺少 Abstract');
  }

  // Required section coverage (45)
  const sectionCoverage = benchmarkCase.requiredSections.filter((section) => includesSection(actualSections, section)).length;
  score += (sectionCoverage / benchmarkCase.requiredSections.length) * 45;
  details.push(`必需章节覆盖 ${sectionCoverage}/${benchmarkCase.requiredSections.length}`);

  // References section (10)
  const hasReferences = markdown.includes('## References') || markdown.includes('\nReferences\n');
  if (hasReferences) {
    score += 10;
    details.push('包含 References');
  } else {
    details.push('缺少 References');
  }

  // Word count (25) — scaled against minWordCount
  const wordCount = countWords(markdown);
  const wordRatio = Math.min(1, wordCount / benchmarkCase.minWordCount);
  score += wordRatio * 25;
  details.push(`字数 ${wordCount}/${benchmarkCase.minWordCount} (${(wordRatio * 100).toFixed(0)}%)`);

  return {
    score: clampScore(score),
    maxScore: 100,
    passed: score >= 70,
    details
  };
}

// ── Coverage ───────────────────────────────────────────────────────────

function scoreCoverage(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  let score = 0;

  const papers = Array.isArray(result.papers) ? (result.papers as Paper[]) : [];
  const paperCount = papers.length;
  score += Math.min(35, (paperCount / benchmarkCase.minPapers) * 35);
  details.push(`候选论文数 ${paperCount}/${benchmarkCase.minPapers}`);

  // Taxonomy (10, reduced from 20 — too easy to get)
  const taxonomyCount = Array.isArray(result.outline?.taxonomy) ? result.outline.taxonomy.length : 0;
  score += Math.min(10, (taxonomyCount / 4) * 10);
  details.push(`taxonomy 条目 ${taxonomyCount}/4`);

  // Paper type coverage (40)
  const paperTypeCoverage = inferPaperTypeCoverage(result);
  const matchedTypes = benchmarkCase.preferredPaperTypes.filter((type) => preferredTypeSatisfied(paperTypeCoverage, type));
  score += (matchedTypes.length / benchmarkCase.preferredPaperTypes.length) * 40;
  details.push(`目标论文类型覆盖 ${matchedTypes.length}/${benchmarkCase.preferredPaperTypes.length}`);

  // Section count penalty — fewer sections than required loses points (15)
  const actualSectionCount = Array.isArray(result.sections) ? result.sections.length : 0;
  const expectedSectionCount = benchmarkCase.requiredSections.length;
  if (actualSectionCount >= expectedSectionCount) {
    score += 15;
    details.push(`章节数 ${actualSectionCount} >= ${expectedSectionCount}`);
  } else {
    const sectionRatio = actualSectionCount / expectedSectionCount;
    score += sectionRatio * 15;
    details.push(`章节数不足 ${actualSectionCount}/${expectedSectionCount}`);
  }

  return {
    score: clampScore(score),
    maxScore: 100,
    passed: score >= 70,
    details
  };
}

// ── Topic Purity ───────────────────────────────────────────────────────

function scoreTopicPurity(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  const sections = Array.isArray(result.sections) ? result.sections : [];

  if (sections.length === 0) {
    return {
      score: 0,
      maxScore: 100,
      passed: false,
      details: ['未生成章节，无法评估 topic purity']
    };
  }

  let totalSectionScore = 0;
  let foreignLeakSectionCount = 0;
  const foreignDomains = new Set<string>();

  for (const section of sections) {
    const evidenceCards = Array.isArray(section.evidenceCards) ? section.evidenceCards : [];
    const intent = inferSectionIntent(String(section.title || ''));
    const normalizedSectionText = sectionText(section);
    const anchorMatches = countAnchorMatches(normalizedSectionText, benchmarkCase.anchorTerms);
    const anchorScore = Math.min(20, (anchorMatches / Math.max(1, Math.min(benchmarkCase.anchorTerms.length, 2))) * 20);

    if (evidenceCards.length === 0) {
      totalSectionScore += anchorScore + 10;
      details.push(`${section.title}: 缺少 evidence card，topic purity 仅靠 anchor 保底`);
      continue;
    }

    const supportingEvidenceCount = evidenceCards.filter((card: any) => {
      const normalizedSignals = new Set<string>(
        (Array.isArray(card.paperTypeSignals) ? card.paperTypeSignals : []).map((signal: string) => normalizePaperTypeSignal(signal))
      );
      return sectionSupportsIntent(intent, normalizedSignals);
    }).length;

    const intentScore = (supportingEvidenceCount / evidenceCards.length) * 70;
    let leakagePenalty = 0;

    if (intent !== 'applications') {
      const foreignCardCount = evidenceCards.filter((card: any) => {
        const cardText = [card.title, card.groundedClaim, card.keyContribution, card.limitationHint].filter(Boolean).join(' ');
        const domains = detectForeignDomains(cardText, benchmarkCase);
        if (domains.length > 0) {
          domains.forEach((domain) => foreignDomains.add(domain));
        }

        const normalizedSignals = new Set<string>(
          (Array.isArray(card.paperTypeSignals) ? card.paperTypeSignals : []).map((signal: string) => normalizePaperTypeSignal(signal))
        );
        const isApplicationLike = normalizedSignals.has('application');
        // Also penalize foreign-domain method/system papers (not just application papers)
        const isMethodOrSystem = normalizedSignals.has('methods') || normalizedSignals.has('system') || normalizedSignals.has('workflow');
        return domains.length > 0 && (isApplicationLike || isMethodOrSystem);
      }).length;

      if (foreignCardCount > 0) {
        foreignLeakSectionCount += 1;
        leakagePenalty = Math.min(25, (foreignCardCount / evidenceCards.length) * 25);
      }
    }

    const sectionScore = clampScore(intentScore + anchorScore + 10 - leakagePenalty);
    totalSectionScore += sectionScore;

    details.push(
      `${section.title}: intent 对齐 ${supportingEvidenceCount}/${evidenceCards.length}, anchor ${anchorMatches}, leakage penalty ${leakagePenalty.toFixed(0)}`
    );
  }

  const score = clampScore(totalSectionScore / sections.length);
  if (foreignLeakSectionCount > 0) {
    details.push(`非 applications 章节出现外域泄漏 ${foreignLeakSectionCount} 处`);
  } else {
    details.push('未发现明显的非 applications 外域泄漏');
  }
  if (foreignDomains.size > 0) {
    details.push(`检测到外域信号: ${[...foreignDomains].join(', ')}`);
  }

  return {
    score,
    maxScore: 100,
    passed: score >= 70,
    details
  };
}

// ── Citations ──────────────────────────────────────────────────────────

function scoreCitations(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  let score = 0;

  const markdown = String(result.formatted_output || result.summary || '');
  const inlineCitations = extractInlineCitations(markdown);
  const uniqueCitations = new Set(inlineCitations);
  const referenceCount = inferReferenceCount(result);

  // Unique citation count (25)
  if (uniqueCitations.size > 0) {
    score += Math.min(25, uniqueCitations.size * 4);
    details.push(`唯一正文引用 ${uniqueCitations.size} 个`);
  } else {
    details.push('正文未发现引用');
  }

  // Valid citation ratio (20)
  const validCitations = [...uniqueCitations].filter((c) => c >= 1 && c <= Math.max(referenceCount, 1)).length;
  score += uniqueCitations.size > 0 ? (validCitations / uniqueCitations.size) * 20 : 0;
  details.push(`有效引用编号 ${validCitations}/${uniqueCitations.size || 1}`);

  // Ghost citation penalty (up to -15)
  const ghostCount = uniqueCitations.size - validCitations;
  if (ghostCount > 0) {
    const ghostPenalty = Math.min(15, ghostCount * 5);
    score -= ghostPenalty;
    details.push(`幽灵引用 ${ghostCount} 个 (-${ghostPenalty})`);
  } else if (uniqueCitations.size > 0) {
    score += 10;
    details.push('无幽灵引用 (+10)');
  }

  // Citation density — at least 1 citation per 150 words of body (10)
  const wordCount = countWords(markdown);
  const expectedCitations = Math.max(1, Math.floor(wordCount / 150));
  const densityRatio = Math.min(1, inlineCitations.length / expectedCitations);
  score += densityRatio * 10;
  details.push(`引用密度 ${inlineCitations.length}/${expectedCitations} (期望每150词≥1)`);

  // Claim alignments (35)
  const claimAlignmentCount = inferClaimAlignmentCount(result);
  score += Math.min(35, (claimAlignmentCount / benchmarkCase.minClaimAlignments) * 35);
  details.push(`claim alignment ${claimAlignmentCount}/${benchmarkCase.minClaimAlignments}`);

  return {
    score: clampScore(score),
    maxScore: 100,
    passed: score >= 70,
    details
  };
}

// ── References ─────────────────────────────────────────────────────────

function scoreReferences(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  let score = 0;

  const papers = Array.isArray(result.papers) ? (result.papers as Paper[]) : [];
  const referenceCount = papers.length;
  score += Math.min(35, (referenceCount / benchmarkCase.minReferences) * 35);
  details.push(`参考文献数 ${referenceCount}/${benchmarkCase.minReferences}`);

  const uniqueTitles = new Set(papers.map((paper) => normalizeText(paper.title)));
  const dedupeRatio = referenceCount > 0 ? uniqueTitles.size / referenceCount : 0;
  score += dedupeRatio * 20;
  details.push(`参考文献去重比例 ${(dedupeRatio * 100).toFixed(0)}%`);

  const sources = new Set(
    papers
      .map((paper) => paper.source)
      .filter((source) => typeof source === 'string' && source.trim().length > 0)
      .map((source) => String(source).toLowerCase())
  );
  score += Math.min(15, sources.size * 7.5);
  details.push(`来源多样性 ${sources.size} 个`);

  // Bidirectional citation coverage
  const markdown = String(result.formatted_output || result.summary || '');
  const citedIndices = new Set(
    extractInlineCitations(markdown).filter((n) => n >= 1 && n <= referenceCount)
  );
  if (referenceCount > 0) {
    const coverageRatio = citedIndices.size / referenceCount;
    score += coverageRatio * 20;
    details.push(`引用覆盖率 ${citedIndices.size}/${referenceCount} (${(coverageRatio * 100).toFixed(0)}%)`);

    // Orphan reference penalty
    const orphanCount = referenceCount - citedIndices.size;
    if (orphanCount > 0) {
      const orphanPenalty = Math.min(10, orphanCount * 2);
      score -= orphanPenalty;
      details.push(`孤儿文献 ${orphanCount} 篇 (-${orphanPenalty})`);
    } else {
      score += 10;
      details.push('无孤儿文献 (+10)');
    }
  } else {
    details.push('无可评估的参考文献');
  }

  return {
    score: clampScore(score),
    maxScore: 100,
    passed: score >= 70,
    details
  };
}

// ── PDF / Markdown Quality ─────────────────────────────────────────────

function scorePdf(result: SkillResult, artifacts: BenchmarkArtifacts): BenchmarkMetric {
  const details: string[] = [];
  let score = 0;

  const markdown = String(result.formatted_output || result.summary || '');
  const actualSections = Array.isArray(result.sections) ? result.sections.map((s: any) => s.title) : [];

  // Check that actual generated section headings appear in markdown (dynamic, not hardcoded)
  const hasAbstract = markdown.includes('## Abstract');
  const hasReferences = markdown.includes('## References');
  const sectionHeadingsFound = actualSections.filter((title: string) =>
    markdown.includes(`## ${title}`)
  ).length;
  const totalExpected = actualSections.length + 2; // + Abstract + References
  const foundCount = sectionHeadingsFound + (hasAbstract ? 1 : 0) + (hasReferences ? 1 : 0);
  const headingRatio = totalExpected > 0 ? foundCount / totalExpected : 0;

  score += headingRatio * 45;
  details.push(`Markdown 章节标题覆盖 ${foundCount}/${totalExpected} (${(headingRatio * 100).toFixed(0)}%)`);

  if (artifacts.pdfPath && fs.existsSync(artifacts.pdfPath)) {
    const stat = fs.statSync(artifacts.pdfPath);
    if (stat.size > 2048) {
      score += 55;
      details.push(`PDF 已生成，大小 ${stat.size} bytes`);
    } else {
      score += 20;
      details.push(`PDF 已生成但文件过小，大小 ${stat.size} bytes`);
    }
  } else {
    details.push('PDF 未生成');
  }

  return {
    score: clampScore(score),
    maxScore: 100,
    passed: score >= 40,
    details
  };
}

// ── Quality Gate ───────────────────────────────────────────────────────

function scoreQualityGate(
  result: SkillResult,
  externalQa?: BenchmarkArtifacts['externalQa']
): BenchmarkMetric {
  const details: string[] = [];
  const workflowScore = clampScore(Number(result.quality_report?.overallScore || 0));
  details.push(`workflow 质量门分数 ${workflowScore}`);

  if (!externalQa) {
    return {
      score: workflowScore,
      maxScore: 100,
      passed: workflowScore >= 70,
      details
    };
  }

  const llmQaScore = clampScore(Number(externalQa.score || 0));
  const discrepancy = Math.abs(workflowScore - llmQaScore);
  const disagreementPenalty = Math.max(0, discrepancy - 10);
  const calibratedScore = clampScore(Math.min(workflowScore, llmQaScore) - disagreementPenalty);

  details.push(`strict LLM QA 分数 ${llmQaScore}`);
  details.push(`质量分歧 ${discrepancy}`);
  if (disagreementPenalty > 0) {
    details.push(`分歧惩罚 -${disagreementPenalty}`);
  }
  details.push(`校准后质量门分数 ${calibratedScore}`);
  if (!externalQa.passed) {
    details.push('strict LLM QA 未通过，aggregate score 将被质量门封顶');
  }

  return {
    score: calibratedScore,
    maxScore: 100,
    passed: workflowScore >= 70 && externalQa.passed && calibratedScore >= 70,
    details
  };
}

// ── Public API ─────────────────────────────────────────────────────────

export function scoreSurveyBenchmarkCase(
  benchmarkCase: SurveyBenchmarkCase,
  result: SkillResult,
  artifacts: BenchmarkArtifacts = {}
): SurveyBenchmarkTopicScorecard {
  return {
    structure: scoreStructure(benchmarkCase, result),
    coverage: scoreCoverage(benchmarkCase, result),
    citations: scoreCitations(benchmarkCase, result),
    references: scoreReferences(benchmarkCase, result),
    topicPurity: scoreTopicPurity(benchmarkCase, result),
    pdf: scorePdf(result, artifacts),
    qualityGate: scoreQualityGate(result, artifacts.externalQa)
  };
}

export function aggregateSurveyBenchmarkScore(scorecard: SurveyBenchmarkTopicScorecard): number {
  // Rebalanced to reduce structure/PDF saturation and reflect section-level topical fit.
  const baseScore = clampScore(
    scorecard.structure.score * 0.14 +
      scorecard.coverage.score * 0.14 +
      scorecard.citations.score * 0.22 +
      scorecard.references.score * 0.16 +
      scorecard.topicPurity.score * 0.18 +
      scorecard.pdf.score * 0.05 +
      scorecard.qualityGate.score * 0.11
  );

  // A failed quality gate should fail the benchmark, even if structural metrics are high.
  return scorecard.qualityGate.passed ? baseScore : Math.min(baseScore, 69);
}
