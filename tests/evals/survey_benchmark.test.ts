import { describe, expect, it } from 'vitest';
import { aggregateSurveyBenchmarkScore, scoreSurveyBenchmarkCase } from '../../src/evals/survey-benchmark/scorer.js';
import { computeSurgeMetrics } from '../../src/evals/survey-benchmark/metrics.js';
import { SURVEY_BENCHMARK_CASES } from '../../src/evals/survey-benchmark/dataset.js';
import { classifyBenchmarkError, summarizeBenchmarkResults } from '../../src/evals/survey-benchmark/run.js';

describe('survey benchmark scorer', () => {
  it('should score a grounded survey result with reasonable aggregate score', () => {
    const benchmarkCase = SURVEY_BENCHMARK_CASES[0];
    const result = {
      outline: {
        title: 'A Survey of AI Agent for Scientific Research',
        taxonomy: ['systems', 'benchmarks', 'workflows', 'challenges']
      },
      papers: [
        { title: 'AstaBench: Benchmarking Scientific Research Agents', source: 'arxiv' },
        { title: 'AI-Researcher: Autonomous Scientific Innovation', source: 'openalex' },
        { title: 'A Survey of AI Agent for Scientific Research', source: 'openalex' },
        { title: 'Scientific Workflow Agents in Discovery Labs', source: 'arxiv' },
        { title: 'Evaluation Protocols for Scientific Agents', source: 'openalex' },
        { title: 'Agentic Research Workflows', source: 'arxiv' },
        { title: 'Open Challenges for Scientific Discovery Systems', source: 'openalex' },
        { title: 'Systems for Scientific Literature Review Automation', source: 'arxiv' }
      ],
      sections: [
        {
          title: 'Background and Scope',
          evidenceCards: [{ paperTypeSignals: ['survey'], citation: 1 }],
          claimAlignments: [{ claim: 'Background claim', citations: [1], evidenceTitles: ['A Survey of AI Agent for Scientific Research'] }]
        },
        {
          title: 'Evaluation and Benchmarks',
          evidenceCards: [{ paperTypeSignals: ['benchmark', 'evaluation'], citation: 2 }],
          claimAlignments: [{ claim: 'Benchmark claim', citations: [2], evidenceTitles: ['AstaBench: Benchmarking Scientific Research Agents'] }]
        },
        {
          title: 'Applications and Systems',
          evidenceCards: [{ paperTypeSignals: ['system', 'workflow'], citation: 3 }],
          claimAlignments: [{ claim: 'System claim', citations: [3], evidenceTitles: ['AI-Researcher: Autonomous Scientific Innovation'] }]
        },
        {
          title: 'Open Challenges',
          evidenceCards: [{ paperTypeSignals: ['survey'], citation: 4 }],
          claimAlignments: [{ claim: 'Challenge claim', citations: [4], evidenceTitles: ['Open Challenges for Scientific Discovery Systems'] }]
        },
        {
          title: 'Core Methods',
          evidenceCards: [{ paperTypeSignals: ['system', 'workflow'], citation: 5 }],
          claimAlignments: [{ claim: 'Methods claim', citations: [5], evidenceTitles: ['Agentic Research Workflows'] }]
        }
      ],
      formatted_output: `# A Survey of AI Agent for Scientific Research

## Abstract

This survey reviews the field.

## Background and Scope

Grounded discussion [1][2].

## Core Methods

Grounded methods synthesis [3][4].

## Evaluation and Benchmarks

Grounded benchmark synthesis [2][5].

## Applications and Systems

Grounded systems synthesis [3][6].

## Open Challenges

Grounded challenges synthesis [7][8].

## References

1. Ref
2. Ref
3. Ref
4. Ref
5. Ref
6. Ref
7. Ref
8. Ref`,
      quality_report: {
        overallScore: 82
      }
    };

    const scorecard = scoreSurveyBenchmarkCase(benchmarkCase, result as any, {});
    const aggregate = aggregateSurveyBenchmarkScore(scorecard);

    expect(scorecard.structure.score).toBeGreaterThanOrEqual(70);
    expect(scorecard.coverage.score).toBeGreaterThanOrEqual(70);
    expect(scorecard.citations.score).toBeGreaterThanOrEqual(70);
    expect(scorecard.references.score).toBeGreaterThanOrEqual(70);
    expect(scorecard.qualityGate.score).toBe(82);
    expect(aggregate).toBeGreaterThanOrEqual(70);

    // SurGE-style metrics should be computable from the same result
    const surgeMetrics = computeSurgeMetrics(
      result.formatted_output,
      benchmarkCase.requiredSections
    );
    expect(surgeMetrics.structuralSimilarity).toBeGreaterThan(0.5);
    expect(surgeMetrics.composite).toBeGreaterThan(0);
  });

  it('should calibrate aggregate score down when strict LLM QA fails', () => {
    const benchmarkCase = SURVEY_BENCHMARK_CASES[0];
    const result = {
      outline: {
        title: 'A Survey of AI Agent for Scientific Research',
        taxonomy: ['systems', 'benchmarks', 'workflows', 'challenges']
      },
      papers: Array.from({ length: 8 }, (_, index) => ({
        title: `Reference ${index + 1}`,
        source: index % 2 === 0 ? 'arxiv' : 'openalex'
      })),
      sections: [
        {
          title: 'Background and Scope',
          evidenceCards: [{ paperTypeSignals: ['survey'], citation: 1 }],
          claimAlignments: [{ claim: 'Background claim', citations: [1], evidenceTitles: ['Reference 1'] }]
        },
        {
          title: 'Core Methods',
          evidenceCards: [{ paperTypeSignals: ['system', 'workflow'], citation: 2 }],
          claimAlignments: [{ claim: 'Methods claim', citations: [2], evidenceTitles: ['Reference 2'] }]
        },
        {
          title: 'Evaluation and Benchmarks',
          evidenceCards: [{ paperTypeSignals: ['benchmark', 'evaluation'], citation: 3 }],
          claimAlignments: [{ claim: 'Benchmark claim', citations: [3], evidenceTitles: ['Reference 3'] }]
        },
        {
          title: 'Applications and Systems',
          evidenceCards: [{ paperTypeSignals: ['system', 'workflow'], citation: 4 }],
          claimAlignments: [{ claim: 'Systems claim', citations: [4], evidenceTitles: ['Reference 4'] }]
        },
        {
          title: 'Open Challenges',
          evidenceCards: [{ paperTypeSignals: ['challenges'], citation: 5 }],
          claimAlignments: [{ claim: 'Challenge claim', citations: [5], evidenceTitles: ['Reference 5'] }]
        }
      ],
      formatted_output: `# A Survey of AI Agent for Scientific Research

## Abstract

This survey reviews the field and provides a structured synthesis.

## Background and Scope

Grounded discussion [1][2].

## Core Methods

Grounded methods synthesis [2][3].

## Evaluation and Benchmarks

Grounded benchmark synthesis [3][4].

## Applications and Systems

Grounded systems synthesis [4][5].

## Open Challenges

Grounded challenges synthesis [5][6][7][8].

## References

1. Ref
2. Ref
3. Ref
4. Ref
5. Ref
6. Ref
7. Ref
8. Ref`,
      quality_report: {
        overallScore: 80
      }
    };

    const scorecard = scoreSurveyBenchmarkCase(benchmarkCase, result as any, {
      externalQa: {
        score: 65,
        passed: false
      }
    });
    const aggregate = aggregateSurveyBenchmarkScore(scorecard);

    expect(scorecard.qualityGate.score).toBeLessThan(70);
    expect(scorecard.qualityGate.passed).toBe(false);
    expect(scorecard.qualityGate.details.join(' ')).toContain('strict LLM QA 未通过');
    expect(aggregate).toBeLessThan(70);
  });

  it('should exclude infrastructure failures from aggregate summary stats', () => {
    const summary = summarizeBenchmarkResults([
      {
        aggregateScore: 92,
        countedInAggregate: true
      },
      {
        aggregateScore: null,
        countedInAggregate: false,
        failureCategory: 'infrastructure'
      },
      {
        aggregateScore: 40,
        countedInAggregate: true,
        failureCategory: 'execution'
      }
    ] as any);

    expect(summary.scoredCaseCount).toBe(2);
    expect(summary.excludedCaseCount).toBe(1);
    expect(summary.infrastructureFailureCount).toBe(1);
    expect(summary.executionFailureCount).toBe(1);
    expect(summary.passedCount).toBe(1);
    expect(summary.averageScore).toBe(66);
  });

  it('should classify connection-style errors as infrastructure failures', () => {
    expect(classifyBenchmarkError(new Error('Connection error while contacting provider'))).toBe('infrastructure');
    expect(classifyBenchmarkError(new Error('UND_ERR_SOCKET disconnected'))).toBe('infrastructure');
    expect(classifyBenchmarkError(new Error('Unhandled TypeError in section writer'))).toBe('execution');
  });
});
