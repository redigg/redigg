import { describe, expect, it, vi } from 'vitest';
import { writeSurveySections } from '../../skills/research/academic-survey-self-improve/section-writer.ts';
import type { SkillContext } from '../../src/skills/types.js';
import type { SurveyOutline } from '../../skills/research/academic-survey-self-improve/types.js';
import type { Paper } from '../../src/skills/lib/ScholarTool.js';

describe('writeSurveySections', () => {
  it('should build evidence cards and pass them into the drafting prompt', async () => {
    const prompts: string[] = [];
    const chat = vi.fn().mockImplementation(async (messages: { role: string; content: string }[]) => {
      const prompt = messages.map((message) => message.content).join('\n');
      prompts.push(prompt);
      return {
        content: JSON.stringify({
          markdown: '## Evaluation and Benchmarks\n\nThis section compares benchmark evidence across agent systems and shows that benchmark design strongly shapes how scientific-agent performance is interpreted [1][2].',
          claimMappings: [
            {
              claim: 'This section compares benchmark evidence across agent systems and shows that benchmark design strongly shapes how scientific-agent performance is interpreted.',
              citations: [1, 2]
            }
          ]
        })
      };
    });

    const context: SkillContext = {
      llm: { chat } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const outline: SurveyOutline = {
      title: 'A Survey of AI Agent for Scientific Research',
      abstractDraft: 'Draft',
      taxonomy: ['Benchmarks'],
      topicProfile: {
        originalTopic: 'AI Agent for Scientific Research',
        normalizedTopic: 'ai agent for scientific research',
        anchorTerms: ['ai', 'agent', 'scientific', 'research'],
        aliasPhrases: ['AI scientist', 'autonomous scientific discovery'],
        intentFacets: ['survey', 'benchmark', 'system'],
        preferredPaperTypes: ['survey', 'benchmark', 'system'],
        sectionFacets: {
          evaluation: ['benchmark', 'evaluation', 'dataset']
        }
      },
      sections: [
        {
          id: 'evaluation',
          title: 'Evaluation and Benchmarks',
          description: 'Compare benchmark suites, datasets, and metrics.',
          searchQueries: ['AI scientist benchmark'],
          targetWordCount: 220,
          focusFacets: ['benchmark', 'evaluation', 'dataset']
        }
      ]
    };

    const sectionPapers: Paper[] = [
      {
        title: 'AstaBench: Benchmarking Scientific Research Agents',
        authors: ['A'],
        year: 2025,
        summary: 'A benchmark and evaluation suite for scientific research agents with datasets, metrics, and leaderboards.',
        citationCount: 42,
        source: 'arxiv'
      },
      {
        title: 'A Survey of Agentic Systems for Scientific Research',
        authors: ['B'],
        year: 2025,
        summary: 'A survey of agentic systems, workflows, and evaluation practices for scientific research.',
        citationCount: 18,
        source: 'openalex'
      }
    ];

    const paperIndexMap = new Map<string, number>([
      ['astabench: benchmarking scientific research agents', 1],
      ['a survey of agentic systems for scientific research', 2]
    ]);

    const result = await writeSurveySections(
      context,
      'AI Agent for Scientific Research',
      outline,
      { evaluation: sectionPapers },
      paperIndexMap
    );

    expect(prompts[0]).toContain('Evidence cards:');
    expect(prompts[0]).toContain('Grounded claim:');
    expect(result[0].evidenceCards).toHaveLength(2);
    expect(result[0].claimAlignments).toHaveLength(1);
    expect(result[0].claimAlignments[0].citations).toEqual([1, 2]);
    expect(result[0].evidenceCards[0].paperTypeSignals).toEqual(expect.arrayContaining(['benchmark', 'evaluation']));
    expect(result[0].evidenceCards[0].groundedClaim).toContain('AstaBench');
  });
});
