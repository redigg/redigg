export type BenchmarkFailureCategory = 'infrastructure' | 'execution';

export interface SurveyBenchmarkCase {
  id: string;
  topic: string;
  depth: 'brief' | 'standard' | 'deep';
  anchorTerms: string[];
  requiredSections: string[];
  preferredPaperTypes: string[];
  minReferences: number;
  minPapers: number;
  minClaimAlignments: number;
  minWordCount: number;
}

export interface BenchmarkMetric {
  score: number;
  maxScore: number;
  passed: boolean;
  details: string[];
}

export interface SurveyBenchmarkTopicScorecard {
  structure: BenchmarkMetric;
  coverage: BenchmarkMetric;
  citations: BenchmarkMetric;
  references: BenchmarkMetric;
  pdf: BenchmarkMetric;
  qualityGate: BenchmarkMetric;
}

export interface SurgeStyleMetricsSummary {
  rougeL: number;
  rouge2: number;
  structuralSimilarity: number;
  citationRecall: number;
  vocabularyDiversity: number;
  composite: number;
}

export interface SurveyBenchmarkTopicResult {
  benchmarkCase: SurveyBenchmarkCase;
  success: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  aggregateScore: number | null;
  countedInAggregate: boolean;
  scorecard: SurveyBenchmarkTopicScorecard;
  surgeMetrics?: SurgeStyleMetricsSummary;
  outputPaths: {
    markdownPath: string;
    jsonPath: string;
    pdfPath?: string;
  };
  summary: {
    sections: string[];
    paperCount: number;
    referenceCount: number;
    retrievedPaperCount: number;
    referencedPaperCount: number;
    claimAlignmentCount: number;
    uniqueCitationCount: number;
    pdfGenerated: boolean;
  };
  llmQa?: {
    score: number;
    reasoning: string;
    passed: boolean;
    suggestions: string[];
  };
  failureCategory?: BenchmarkFailureCategory;
  error?: string;
}

export interface SurveyBenchmarkRunSummary {
  runId: string;
  generatedAt: string;
  outputDir: string;
  caseCount: number;
  scoredCaseCount: number;
  excludedCaseCount: number;
  infrastructureFailureCount: number;
  executionFailureCount: number;
  passedCount: number;
  averageScore: number | null;
  results: SurveyBenchmarkTopicResult[];
}
