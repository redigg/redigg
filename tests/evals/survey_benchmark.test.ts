import { describe, expect, it } from 'vitest';
import { aggregateSurveyBenchmarkScore, scoreSurveyBenchmarkCase } from '../../src/evals/survey-benchmark/scorer.js';
import { SURVEY_BENCHMARK_CASES } from '../../src/evals/survey-benchmark/dataset.js';

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

    expect(scorecard.structure.score).toBeGreaterThanOrEqual(80);
    expect(scorecard.coverage.score).toBeGreaterThanOrEqual(70);
    expect(scorecard.citations.score).toBeGreaterThanOrEqual(70);
    expect(scorecard.references.score).toBeGreaterThanOrEqual(70);
    expect(scorecard.qualityGate.score).toBe(82);
    expect(aggregate).toBeGreaterThanOrEqual(70);
  });
});
