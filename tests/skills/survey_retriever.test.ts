import { describe, expect, it } from 'vitest';
import { retrieveSurveyPapers } from '../../skills/research/academic-survey-self-improve/retriever.js';
import type { Paper } from '../../src/skills/lib/ScholarTool.js';
import type { SurveyOutline } from '../../skills/research/academic-survey-self-improve/types.js';

describe('retrieveSurveyPapers', () => {
  it('should filter out broad scientific research papers when stronger anchored papers exist', async () => {
    const candidatePapers: Paper[] = [
      {
        title: 'The AI Scientist: Autonomous Scientific Discovery with Foundation Models',
        authors: ['A'],
        year: 2024,
        summary: 'An AI scientist system for autonomous scientific discovery and research workflows.',
        citationCount: 120,
        source: 'openalex'
      },
      {
        title: 'Benchmarking AI Research Agents for Scientific Discovery',
        authors: ['B'],
        year: 2025,
        summary: 'A benchmark and evaluation suite for AI agents in scientific research.',
        citationCount: 35,
        source: 'arxiv'
      },
      {
        title: 'A Survey of Agentic Systems for Scientific Research',
        authors: ['C'],
        year: 2025,
        summary: 'A survey of agentic systems, workflows, and evaluation practices for scientific research.',
        citationCount: 18,
        source: 'openalex'
      },
      {
        title: 'Benchmarking Scientific Research Workflows in University Labs',
        authors: ['D'],
        year: 2023,
        summary: 'A broad study of scientific research workflows and benchmarking practices in laboratory management.',
        citationCount: 10,
        source: 'openalex'
      }
    ];

    const scholar = {
      async searchPapers() {
        return candidatePapers;
      }
    } as any;

    const outline: SurveyOutline = {
      title: 'A Survey of AI Agent for Scientific Research',
      abstractDraft: 'Draft',
      taxonomy: ['Systems', 'Benchmarks'],
      topicProfile: {
        originalTopic: 'AI Agent for Scientific Research',
        normalizedTopic: 'ai agent for scientific research',
        anchorTerms: ['ai', 'agent', 'scientific', 'research'],
        aliasPhrases: ['AI scientist', 'autonomous scientific discovery', 'scientific discovery agent'],
        intentFacets: ['survey', 'benchmark', 'system', 'workflow', 'evaluation'],
        preferredPaperTypes: ['survey', 'review', 'benchmark', 'system', 'framework', 'workflow'],
        sectionFacets: {
          evaluation: ['benchmark', 'evaluation', 'dataset']
        }
      },
      sections: [
        {
          id: 'evaluation',
          title: 'Evaluation and Benchmarks',
          description: 'Compare benchmarks, datasets, and evaluation settings.',
          searchQueries: ['AI Agent for Scientific Research benchmark'],
          targetWordCount: 200,
          focusFacets: ['benchmark', 'evaluation'],
          queryPlan: [
            { query: 'AI Agent for Scientific Research benchmark', facet: 'benchmark', weight: 1, source: 'base' },
            { query: 'AI scientist benchmark', facet: 'benchmark', weight: 0.95, source: 'alias' }
          ]
        }
      ]
    };

    const result = await retrieveSurveyPapers(
      scholar,
      'AI Agent for Scientific Research',
      outline,
      [candidatePapers[0]],
      { sectionLimit: 3, perQueryLimit: 4 }
    );

    const sectionTitles = result.papersBySection.evaluation.map((paper) => paper.title);
    expect(sectionTitles).toEqual(expect.arrayContaining([
      'The AI Scientist: Autonomous Scientific Discovery with Foundation Models',
      'Benchmarking AI Research Agents for Scientific Discovery'
    ]));
    expect(sectionTitles).not.toContain('Benchmarking Scientific Research Workflows in University Labs');
  });
});
