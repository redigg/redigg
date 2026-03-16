import { describe, expect, it, vi } from 'vitest';
import { retrieveSurveyPapers } from '../../skills/research/academic-survey-self-improve/retriever.js';
import type { Paper } from '../../src/skills/lib/ScholarTool.js';
import type { SurveyOutline } from '../../skills/research/academic-survey-self-improve/types.js';

function makePaper(overrides: Partial<Paper> = {}): Paper {
  return {
    title: 'Default Paper',
    authors: ['A'],
    year: 2025,
    summary: 'A relevant paper about AI agents and scientific research workflows.',
    citationCount: 10,
    source: 'openalex',
    ...overrides
  };
}

describe('retriever query convergence', () => {
  it('should early-stop when enough quality papers are found', async () => {
    let callCount = 0;
    const strongPapers: Paper[] = Array.from({ length: 8 }, (_, i) =>
      makePaper({
        title: `AI Agent Discovery System ${i}`,
        summary: `An AI agent system for autonomous scientific research discovery and workflows. System ${i}.`,
        citationCount: 50 + i
      })
    );

    const scholar = {
      async searchPapers() {
        callCount++;
        return strongPapers;
      }
    } as any;

    const outline: SurveyOutline = {
      title: 'Survey',
      abstractDraft: 'Draft',
      taxonomy: ['A'],
      topicProfile: {
        originalTopic: 'AI Agent for Scientific Research',
        normalizedTopic: 'ai agent for scientific research',
        anchorTerms: ['ai', 'agent', 'scientific', 'research'],
        aliasPhrases: ['AI scientist', 'autonomous scientific discovery'],
        intentFacets: ['survey', 'system'],
        preferredPaperTypes: ['survey', 'system'],
        sectionFacets: { sec1: ['system'] }
      },
      sections: [
        {
          id: 'sec1',
          title: 'Systems',
          description: 'Systems for scientific research.',
          searchQueries: ['q1', 'q2', 'q3', 'q4', 'q5'],
          targetWordCount: 200,
          focusFacets: ['system'],
          queryPlan: [
            { query: 'AI agent system', facet: 'system', weight: 1, source: 'base' },
            { query: 'AI scientist system', facet: 'system', weight: 0.9, source: 'alias' },
            { query: 'autonomous discovery system', facet: 'system', weight: 0.8, source: 'alias' },
            { query: 'scientific research platform', facet: 'system', weight: 0.7, source: 'facet' },
            { query: 'research workflow orchestration', facet: 'system', weight: 0.6, source: 'facet' }
          ]
        }
      ]
    };

    await retrieveSurveyPapers(scholar, 'AI Agent for Scientific Research', outline, [], {
      sectionLimit: 4,
      perQueryLimit: 8
    });

    // With 8 strong papers returned on first call, early stop should kick in
    // and prevent all 5+ queries from firing
    expect(callCount).toBeLessThanOrEqual(2);
  });

  it('should filter off-topic papers from search batches', async () => {
    const mixedBatch: Paper[] = [
      makePaper({
        title: 'AI Agent for Autonomous Scientific Discovery',
        summary: 'An AI agent system for scientific research discovery workflows.'
      }),
      makePaper({
        title: 'Cooking Recipe Recommendation System',
        summary: 'A recommendation system for cooking recipes using collaborative filtering.'
      }),
      makePaper({
        title: 'Weather Prediction with Deep Learning',
        summary: 'Deep learning methods for weather forecasting and climate modeling.'
      })
    ];

    const scholar = {
      async searchPapers() {
        return mixedBatch;
      }
    } as any;

    const outline: SurveyOutline = {
      title: 'Survey',
      abstractDraft: 'Draft',
      taxonomy: ['A'],
      topicProfile: {
        originalTopic: 'AI Agent for Scientific Research',
        normalizedTopic: 'ai agent for scientific research',
        anchorTerms: ['ai', 'agent', 'scientific', 'research'],
        aliasPhrases: ['AI scientist'],
        intentFacets: ['survey', 'system'],
        preferredPaperTypes: ['survey', 'system'],
        sectionFacets: { sec1: ['system'] }
      },
      sections: [
        {
          id: 'sec1',
          title: 'Systems',
          description: 'Systems for scientific research.',
          searchQueries: ['AI agent system'],
          targetWordCount: 200,
          focusFacets: ['system'],
          queryPlan: [
            { query: 'AI agent system', facet: 'system', weight: 1, source: 'base' }
          ]
        }
      ]
    };

    const result = await retrieveSurveyPapers(scholar, 'AI Agent for Scientific Research', outline, [], {
      sectionLimit: 3,
      perQueryLimit: 4
    });

    const titles = result.papersBySection.sec1.map((p) => p.title);
    expect(titles).toContain('AI Agent for Autonomous Scientific Discovery');
    // Off-topic papers should be ranked lower or filtered
    expect(titles[0]).toBe('AI Agent for Autonomous Scientific Discovery');
  });
});
