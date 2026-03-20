import { describe, expect, it, vi } from 'vitest';
import { reviewSurveySections } from '../../skills/research/academic-survey-self-improve/reviewer.ts';
import type { SkillContext } from '../../src/skills/types.js';
import type { SectionDraft } from '../../skills/research/academic-survey-self-improve/types.js';

describe('reviewSurveySections', () => {
  it('should force rewrite when hard checks fail for a benchmark section', async () => {
    const chat = vi.fn()
      // Cross-review role 1: evidence grounding
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 92,
          strengths: ['Clear prose'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      // Cross-review role 2: synthesis quality
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 90,
          strengths: ['Good structure'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      // Rewrite response
      .mockResolvedValueOnce({
        content: '## Evaluation and Benchmarks\n\nRewritten benchmark section grounded in evidence [1].'
      })
      // Cross-review role 1 after rewrite
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 91,
          strengths: ['Grounded rewrite'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      // Cross-review role 2 after rewrite
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 89,
          strengths: ['Improved benchmark framing'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      });

    const context: SkillContext = {
      llm: { chat } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const sections: SectionDraft[] = [
      {
        sectionId: 'evaluation',
        title: 'Evaluation and Benchmarks',
        templateKind: 'benchmark',
        content: '## Evaluation and Benchmarks\n\nThis section discusses the literature in broad terms without citations.',
        paperCount: 1,
        citations: [1],
        claimAlignments: [],
        evidenceCards: [
          {
            citation: 1,
            title: 'A Survey of Agentic Systems for Scientific Research',
            year: 2025,
            source: 'openalex',
            paperTypeSignals: ['survey'],
            evidenceFocus: ['survey', 'workflow'],
            keyContribution: 'A survey of agentic systems and evaluation practices.',
            groundedClaim: 'The paper surveys agentic systems and workflows.',
            limitationHint: 'Open questions remain around benchmark coverage.',
            evidenceLevel: 'review',
            quotableFindings: []
          }
        ]
      }
    ];

    const result = await reviewSurveySections(context, 'AI Agent for Scientific Research', sections);

    expect(result.qualityReport.sectionReviews[0].rewriteApplied).toBe(true);
    expect(result.qualityReport.sectionReviews[0].issues).toEqual(
      expect.arrayContaining([
        'Benchmark section lacks benchmark/evaluation evidence.'
      ])
    );
    expect(result.sections[0].content).toContain('Rewritten benchmark section grounded in evidence');
  });

  it('should keep a well-grounded systems section without forced rewrite', async () => {
    const chat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        score: 88,
        strengths: ['Grounded and specific'],
        issues: [],
        suggestions: [],
        needsRewrite: false
      })
    });

    const context: SkillContext = {
      llm: { chat } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const sections: SectionDraft[] = [
      {
        sectionId: 'systems',
        title: 'Applications and Systems',
        templateKind: 'systems',
        content: '## Applications and Systems\n\nSystems such as Denario and The AI Scientist demonstrate workflow orchestration, tool coordination, and end-to-end discovery loops across literature search, experimentation, and manuscript preparation [1][2]. In both cases, the evidence emphasizes that system-level design choices matter because orchestration determines whether specialized modules can share intermediate findings and reuse outputs across steps [1][2]. The section therefore has grounded system evidence, multiple citations, and an explicit synthesis of how workflow structure affects research quality and deployment robustness [1][2].',
        paperCount: 2,
        citations: [1, 2],
        targetWordCount: 80,
        claimAlignments: [
          {
            claim: 'Systems such as Denario and The AI Scientist demonstrate workflow orchestration, tool coordination, and end-to-end discovery loops across literature search, experimentation, and manuscript preparation.',
            citations: [1, 2],
            evidenceTitles: ['Denario: A Multi-Agent System for Scientific Discovery', 'The AI Scientist']
          },
          {
            claim: 'The evidence emphasizes that system-level design choices matter because orchestration determines whether specialized modules can share intermediate findings and reuse outputs across steps.',
            citations: [1, 2],
            evidenceTitles: ['Denario: A Multi-Agent System for Scientific Discovery', 'The AI Scientist']
          }
        ],
        evidenceCards: [
          {
            citation: 1,
            title: 'Denario: A Multi-Agent System for Scientific Discovery',
            year: 2025,
            source: 'openalex',
            paperTypeSignals: ['system', 'workflow'],
            evidenceFocus: ['system', 'workflow'],
            keyContribution: 'A multi-agent platform for scientific discovery.',
            groundedClaim: 'Denario provides system evidence for end-to-end scientific discovery workflows.',
            limitationHint: 'Deployment robustness remains open.',
            evidenceLevel: 'system',
            quotableFindings: []
          },
          {
            citation: 2,
            title: 'The AI Scientist',
            year: 2024,
            source: 'openalex',
            paperTypeSignals: ['system', 'workflow'],
            evidenceFocus: ['system', 'workflow'],
            keyContribution: 'An autonomous discovery system with iterative experimentation.',
            groundedClaim: 'The AI Scientist demonstrates autonomous discovery loops.',
            limitationHint: 'Reliability and evaluation remain open.',
            evidenceLevel: 'system',
            quotableFindings: []
          }
        ]
      }
    ];

    const result = await reviewSurveySections(context, 'AI Agent for Scientific Research', sections);

    expect(result.qualityReport.sectionReviews[0].rewriteApplied).toBe(false);
    expect(result.qualityReport.sectionReviews[0].issues).not.toEqual(
      expect.arrayContaining(['Systems section lacks system/workflow evidence.'])
    );
    expect(result.qualityReport.sectionReviews[0].strengths).toEqual(
      expect.arrayContaining(['Tracks 2 claim-level citation alignments', 'No fabricated numbers detected'])
    );
  });

  it('should flag unsupported numeric ranges and counted entities even when citations are present', async () => {
    const unchangedDraft = '## Applications and Systems\n\nCurrent applications remain promising but unevenly validated [1]. Some reports claim 80-90% autonomy and describe workflows that run 3-4 times faster than manual baselines while covering 57 agents across 22 classes [1]. These examples are rhetorically plausible, but they are not supported by the attached evidence card and therefore should be treated as fabricated quantitative synthesis rather than grounded reporting [1].';
    const chat = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 87,
          strengths: ['Well structured'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 86,
          strengths: ['Reasonable flow'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      .mockResolvedValueOnce({
        content: unchangedDraft
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 84,
          strengths: ['Still coherent'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 83,
          strengths: ['Still readable'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      });

    const context: SkillContext = {
      llm: { chat } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const sections: SectionDraft[] = [
      {
        sectionId: 'applications',
        title: 'Applications and Systems',
        templateKind: 'systems',
        content: unchangedDraft,
        paperCount: 1,
        citations: [1],
        targetWordCount: 80,
        claimAlignments: [
          {
            claim: 'Current applications remain promising but unevenly validated.',
            citations: [1],
            evidenceTitles: ['Agentic Systems Survey']
          }
        ],
        evidenceCards: [
          {
            citation: 1,
            title: 'Agentic Systems Survey',
            year: 2025,
            source: 'openalex',
            paperTypeSignals: ['system', 'workflow', 'survey'],
            evidenceFocus: ['system', 'workflow'],
            keyContribution: 'The paper surveys agentic system architectures and deployment patterns.',
            groundedClaim: 'Existing agentic systems vary widely in orchestration design and validation depth.',
            limitationHint: 'The survey does not report a unified autonomy rate or standardized speedup figure.',
            evidenceLevel: 'review',
            quotableFindings: []
          }
        ]
      }
    ];

    const result = await reviewSurveySections(context, 'AI Agent for Scientific Research', sections);

    expect(result.qualityReport.sectionReviews[0].rewriteApplied).toBe(true);
    expect(result.qualityReport.sectionReviews[0].issues.join(' ')).toContain('Potentially fabricated numbers detected');
    expect(result.qualityReport.sectionReviews[0].issues.join(' ')).toContain('80-90%');
    expect(result.qualityReport.sectionReviews[0].issues.join(' ')).toContain('3-4 times');
    expect(result.qualityReport.sectionReviews[0].issues.join(' ')).toContain('57 agents');
    expect(result.qualityReport.sectionReviews[0].issues.join(' ')).toContain('22 classes');
  });

  it('should preserve comma-formatted grounded counts without malformed fabricated-number warnings', async () => {
    const originalDraft = '## Methods: Advanced Reasoning Capabilities\n\nGraph-based contradiction analysis remains attractive because it can scale structured evidence synthesis to large corpora when the underlying knowledge representation is stable [1]. The cited evidence explicitly notes that pairwise document comparisons become prohibitive beyond 10,000 papers, making that count a grounded tractability threshold rather than an invented benchmark statistic [1]. This limitation is used here only to characterize computational scaling pressure, not to claim unsupported system-level superiority or accuracy gains [1].';
    const chat = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 86,
          strengths: ['Grounded and specific'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 85,
          strengths: ['Clear synthesis'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      .mockResolvedValueOnce({
        content: originalDraft
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 86,
          strengths: ['Grounded and specific'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 85,
          strengths: ['Clear synthesis'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      });

    const context: SkillContext = {
      llm: { chat } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const sections: SectionDraft[] = [
      {
        sectionId: 'methods-reasoning',
        title: 'Methods: Advanced Reasoning Capabilities',
        templateKind: 'methods',
        content: originalDraft,
        paperCount: 1,
        citations: [1],
        targetWordCount: 80,
        claimAlignments: [
          {
            claim: 'The cited evidence explicitly notes that pairwise document comparisons become prohibitive beyond 10,000 papers, making that count a grounded tractability threshold rather than an invented benchmark statistic.',
            citations: [1],
            evidenceTitles: ['SciAgents']
          }
        ],
        evidenceCards: [
          {
            citation: 1,
            title: 'SciAgents',
            year: 2024,
            source: 'openalex',
            paperTypeSignals: ['methods', 'system'],
            evidenceFocus: ['methods', 'reasoning'],
            keyContribution: 'SciAgents applies bioinspired graph reasoning to scientific discovery workflows.',
            groundedClaim: 'Graph-based approaches face scaling constraints as pairwise comparisons grow rapidly with corpus size.',
            limitationHint: 'Pairwise document comparisons become prohibitive beyond 10,000 papers.',
            evidenceLevel: 'system',
            quotableFindings: ['pairwise document comparisons become prohibitive beyond 10,000 papers']
          }
        ]
      }
    ];

    const result = await reviewSurveySections(context, 'AI Agent for Scientific Research', sections);

    expect(result.qualityReport.sectionReviews[0].issues.join(' ')).not.toContain('Potentially fabricated numbers detected');
    expect(result.qualityReport.sectionReviews[0].issues.join(' ')).not.toContain('000 papers');
  });
});
