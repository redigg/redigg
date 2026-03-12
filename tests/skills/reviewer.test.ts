import { describe, expect, it, vi } from 'vitest';
import { reviewSurveySections } from '../../skills/research/academic-survey-self-improve/reviewer.ts';
import type { SkillContext } from '../../src/skills/types.js';
import type { SectionDraft } from '../../skills/research/academic-survey-self-improve/types.js';

describe('reviewSurveySections', () => {
  it('should force rewrite when hard checks fail for a benchmark section', async () => {
    const chat = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 92,
          strengths: ['Clear prose'],
          issues: [],
          suggestions: [],
          needsRewrite: false
        })
      })
      .mockResolvedValueOnce({
        content: '## Evaluation and Benchmarks\n\nRewritten benchmark section grounded in evidence [1][2].'
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
        content: '## Evaluation and Benchmarks\n\nThis section discusses the literature in broad terms without citations.',
        paperCount: 1,
        citations: [1],
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
            limitationHint: 'Open questions remain around benchmark coverage.'
          }
        ]
      }
    ];

    const result = await reviewSurveySections(context, 'AI Agent for Scientific Research', sections);

    expect(result.qualityReport.sectionReviews[0].rewriteApplied).toBe(true);
    expect(result.qualityReport.sectionReviews[0].issues).toEqual(
      expect.arrayContaining([
        'The section does not cite any supporting evidence.',
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
        content: '## Applications and Systems\n\nSystems such as Denario and The AI Scientist demonstrate workflow orchestration, tool coordination, and end-to-end discovery loops across literature search, experimentation, and manuscript preparation [1][2]. In both cases, the evidence emphasizes that system-level design choices matter because orchestration determines whether specialized modules can share intermediate findings and reuse outputs across steps [1][2]. The section therefore has grounded system evidence, multiple citations, and an explicit synthesis of how workflow structure affects research quality and deployment robustness [1][2].',
        paperCount: 2,
        citations: [1, 2],
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
            limitationHint: 'Deployment robustness remains open.'
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
            limitationHint: 'Reliability and evaluation remain open.'
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
      expect.arrayContaining(['Systems section includes system/workflow evidence'])
    );
  });
});
