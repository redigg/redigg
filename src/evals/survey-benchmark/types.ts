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

export interface SurveyBenchmarkTopicResult {
  benchmarkCase: SurveyBenchmarkCase;
  success: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  aggregateScore: number;
  scorecard: SurveyBenchmarkTopicScorecard;
  outputPaths: {
    markdownPath: string;
    jsonPath: string;
    pdfPath?: string;
  };
  summary: {
    sections: string[];
    paperCount: number;
    referenceCount: number;
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
  error?: string;
}

export interface SurveyBenchmarkRunSummary {
  runId: string;
  generatedAt: string;
  outputDir: string;
  caseCount: number;
  passedCount: number;
  averageScore: number;
  results: SurveyBenchmarkTopicResult[];
}
