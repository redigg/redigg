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
  const matchedTypes = benchmarkCase.preferredPaperTypes.filter((type) => paperTypeCoverage.has(type));
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
    pdf: scorePdf(result, artifacts),
    qualityGate: scoreQualityGate(result)
  };
}

export function aggregateSurveyBenchmarkScore(scorecard: SurveyBenchmarkTopicScorecard): number {
  // Weights: content quality (citations + references) = 40%, structure = 20%,
  // coverage = 15%, quality gate = 15%, PDF = 10%
  return clampScore(
    scorecard.structure.score * 0.20 +
      scorecard.coverage.score * 0.15 +
      scorecard.citations.score * 0.25 +
      scorecard.references.score * 0.15 +
      scorecard.pdf.score * 0.10 +
      scorecard.qualityGate.score * 0.15
  );
}
