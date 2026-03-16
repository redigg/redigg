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
}

function clampScore(value: number, maxScore = 100): number {
  return Math.max(0, Math.min(maxScore, Math.round(value)));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeText(value).split(/\s+/).filter(Boolean));
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
  if (Array.isArray(result.papers)) {
    return result.papers.length;
  }

  return 0;
}

function inferPaperTypeCoverage(result: SkillResult): Set<string> {
  const paperTypes = new Set<string>();
  const sections = Array.isArray(result.sections) ? result.sections : [];

  for (const section of sections) {
    const evidenceCards = Array.isArray(section.evidenceCards) ? section.evidenceCards : [];
    for (const evidence of evidenceCards) {
      const signals = Array.isArray(evidence.paperTypeSignals) ? evidence.paperTypeSignals : [];
      for (const signal of signals) {
        paperTypes.add(String(signal).toLowerCase());
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

function scoreStructure(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  const actualSections = Array.isArray(result.sections) ? result.sections.map((section: any) => section.title) : [];
  const markdown = String(result.formatted_output || result.summary || '');
  let score = 0;

  const hasTitle = typeof result.outline?.title === 'string' && result.outline.title.trim().length > 0;
  if (hasTitle) {
    score += 15;
    details.push('包含 survey 标题');
  } else {
    details.push('缺少 survey 标题');
  }

  const hasAbstract = markdown.includes('## Abstract');
  if (hasAbstract) {
    score += 15;
    details.push('包含 Abstract');
  } else {
    details.push('缺少 Abstract');
  }

  const sectionCoverage = benchmarkCase.requiredSections.filter((section) => includesSection(actualSections, section)).length;
  score += (sectionCoverage / benchmarkCase.requiredSections.length) * 55;
  details.push(`必需章节覆盖 ${sectionCoverage}/${benchmarkCase.requiredSections.length}`);

  const hasReferences = markdown.includes('## References') || markdown.includes('\nReferences\n');
  if (hasReferences) {
    score += 15;
    details.push('包含 References');
  } else {
    details.push('缺少 References');
  }

  return {
    score: clampScore(score),
    maxScore: 100,
    passed: score >= 75,
    details
  };
}

function scoreCoverage(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  let score = 0;

  const papers = Array.isArray(result.papers) ? (result.papers as Paper[]) : [];
  const paperCount = papers.length;
  score += Math.min(35, (paperCount / benchmarkCase.minPapers) * 35);
  details.push(`候选论文数 ${paperCount}/${benchmarkCase.minPapers}`);

  const taxonomyCount = Array.isArray(result.outline?.taxonomy) ? result.outline.taxonomy.length : 0;
  score += Math.min(20, (taxonomyCount / 4) * 20);
  details.push(`taxonomy 条目 ${taxonomyCount}/4`);

  const paperTypeCoverage = inferPaperTypeCoverage(result);
  const matchedTypes = benchmarkCase.preferredPaperTypes.filter((type) => paperTypeCoverage.has(type));
  score += (matchedTypes.length / benchmarkCase.preferredPaperTypes.length) * 45;
  details.push(`目标论文类型覆盖 ${matchedTypes.length}/${benchmarkCase.preferredPaperTypes.length}`);

  return {
    score: clampScore(score),
    maxScore: 100,
    passed: score >= 70,
    details
  };
}

function scoreCitations(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  let score = 0;

  const markdown = String(result.formatted_output || result.summary || '');
  const inlineCitations = extractInlineCitations(markdown);
  const uniqueCitations = new Set(inlineCitations);
  const referenceCount = inferReferenceCount(result);

  if (uniqueCitations.size > 0) {
    score += Math.min(35, uniqueCitations.size * 5);
    details.push(`唯一正文引用 ${uniqueCitations.size} 个`);
  } else {
    details.push('正文未发现引用');
  }

  const validCitations = [...uniqueCitations].filter((citation) => citation >= 1 && citation <= Math.max(referenceCount, 1)).length;
  score += uniqueCitations.size > 0 ? (validCitations / uniqueCitations.size) * 25 : 0;
  details.push(`有效引用编号 ${validCitations}/${uniqueCitations.size || 1}`);

  const claimAlignmentCount = inferClaimAlignmentCount(result);
  score += Math.min(40, (claimAlignmentCount / benchmarkCase.minClaimAlignments) * 40);
  details.push(`claim alignment ${claimAlignmentCount}/${benchmarkCase.minClaimAlignments}`);

  return {
    score: clampScore(score),
    maxScore: 100,
    passed: score >= 70,
    details
  };
}

function scoreReferences(benchmarkCase: SurveyBenchmarkCase, result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  let score = 0;

  const papers = Array.isArray(result.papers) ? (result.papers as Paper[]) : [];
  const referenceCount = papers.length;
  score += Math.min(40, (referenceCount / benchmarkCase.minReferences) * 40);
  details.push(`参考文献数 ${referenceCount}/${benchmarkCase.minReferences}`);

  const uniqueTitles = new Set(papers.map((paper) => normalizeText(paper.title)));
  const dedupeRatio = referenceCount > 0 ? uniqueTitles.size / referenceCount : 0;
  score += dedupeRatio * 25;
  details.push(`参考文献去重比例 ${(dedupeRatio * 100).toFixed(0)}%`);

  const sources = new Set(
    papers
      .map((paper) => paper.source)
      .filter((source) => typeof source === 'string' && source.trim().length > 0)
      .map((source) => String(source).toLowerCase())
  );
  score += Math.min(20, sources.size * 10);
  details.push(`来源多样性 ${sources.size} 个`);

  const citedCount = extractInlineCitations(String(result.formatted_output || result.summary || '')).length;
  if (referenceCount > 0) {
    const citedRatio = Math.min(1, citedCount / referenceCount);
    score += citedRatio * 15;
    details.push(`正文引用覆盖 ${(citedRatio * 100).toFixed(0)}%`);
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

function scorePdf(result: SkillResult, artifacts: BenchmarkArtifacts): BenchmarkMetric {
  const details: string[] = [];
  let score = 0;

  const markdown = String(result.formatted_output || result.summary || '');
  const hasAcademicHeadings =
    markdown.includes('## Abstract') &&
    markdown.includes('## References') &&
    markdown.includes('## Background') &&
    markdown.includes('## Core Methods');

  if (hasAcademicHeadings) {
    score += 45;
    details.push('Markdown 结构具备论文样式章节');
  } else {
    details.push('Markdown 缺少论文样式章节');
  }

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
    passed: score >= 65,
    details
  };
}

function scoreQualityGate(result: SkillResult): BenchmarkMetric {
  const details: string[] = [];
  const overallScore = Number(result.quality_report?.overallScore || 0);
  details.push(`workflow 质量门分数 ${overallScore}`);

  return {
    score: clampScore(overallScore),
    maxScore: 100,
    passed: overallScore >= 70,
    details
  };
}

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
    pdf: scorePdf(result, artifacts),
    qualityGate: scoreQualityGate(result)
  };
}

export function aggregateSurveyBenchmarkScore(scorecard: SurveyBenchmarkTopicScorecard): number {
  return clampScore(
    scorecard.structure.score * 0.2 +
      scorecard.coverage.score * 0.2 +
      scorecard.citations.score * 0.2 +
      scorecard.references.score * 0.15 +
      scorecard.pdf.score * 0.1 +
      scorecard.qualityGate.score * 0.15
  );
}
