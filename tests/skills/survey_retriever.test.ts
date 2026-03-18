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
      },
      async expandCitationGraph() {
        return [];
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

  it('should drop noisy low-quality batches instead of keeping off-topic spillover', async () => {
    const candidatePapers: Paper[] = [
      {
        title: 'AstaBench: Benchmarking Scientific Research Agents',
        authors: ['A'],
        year: 2025,
        summary: 'A benchmark and evaluation suite for scientific research agents with datasets and leaderboards.',
        citationCount: 42,
        source: 'arxiv'
      },
      {
        title: 'Socioeconomic driving forces of scientific research',
        authors: ['B'],
        year: 2018,
        summary: 'A broad perspective on scientific research productivity and institutions.',
        citationCount: 55,
        source: 'openalex'
      },
      {
        title: 'Cognitive Science: An Introduction to the Study of Mind',
        authors: ['C'],
        year: 2005,
        summary: 'A textbook introduction to cognitive science and the study of mind.',
        citationCount: 200,
        source: 'openalex'
      },
      {
        title: 'Learning analytics and AI: Politics, pedagogy and practices',
        authors: ['D'],
        year: 2019,
        summary: 'A survey of learning analytics and AI in educational practice.',
        citationCount: 18,
        source: 'openalex'
      },
      {
        title: 'Theory-Driven Perspectives on Generative Artificial Intelligence in Business and Management',
        authors: ['E'],
        year: 2025,
        summary: 'A perspective piece on generative artificial intelligence in business and management research.',
        citationCount: 7,
        source: 'openalex'
      }
    ];

    const scholar = {
      async searchPapers() {
        return candidatePapers;
      },
      async expandCitationGraph() {
        return [];
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
          evaluation: ['benchmark', 'evaluation', 'dataset', 'leaderboard']
        }
      },
      sections: [
        {
          id: 'evaluation',
          title: 'Evaluation and Benchmarks',
          description: 'Compare benchmarks, datasets, and evaluation settings.',
          searchQueries: ['AI Agent for Scientific Research benchmark'],
          targetWordCount: 200,
          focusFacets: ['benchmark', 'evaluation', 'dataset'],
          queryPlan: [
            { query: 'AI Agent for Scientific Research benchmark', facet: 'benchmark', weight: 1, source: 'base' }
          ]
        }
      ]
    };

    const result = await retrieveSurveyPapers(
      scholar,
      'AI Agent for Scientific Research',
      outline,
      [candidatePapers[0]],
      { sectionLimit: 3, perQueryLimit: 5 }
    );

    const sectionTitles = result.papersBySection.evaluation.map((paper) => paper.title);
    expect(sectionTitles).toContain('AstaBench: Benchmarking Scientific Research Agents');
    expect(sectionTitles).not.toContain('Socioeconomic driving forces of scientific research');
    expect(sectionTitles).not.toContain('Cognitive Science: An Introduction to the Study of Mind');
    expect(sectionTitles).not.toContain('Learning analytics and AI: Politics, pedagogy and practices');
    expect(sectionTitles).not.toContain('Theory-Driven Perspectives on Generative Artificial Intelligence in Business and Management');
  });

  it('should expand papers via citation graph snowball retrieval', async () => {
    const seedPapers: Paper[] = [
      {
        title: 'The AI Scientist: Autonomous Scientific Discovery',
        authors: ['A'],
        year: 2024,
        summary: 'An AI scientist system for autonomous scientific discovery and research.',
        citationCount: 120,
        source: 'openalex',
        externalIds: { ArXiv: '2304.05376' }
      }
    ];

    const snowballPapers: Paper[] = [
      {
        title: 'ChemCrow: Augmenting LLMs with Chemistry Tools for Scientific Research',
        authors: ['B'],
        year: 2024,
        summary: 'An LLM agent augmented with chemistry-specific tools for autonomous research.',
        citationCount: 80,
        source: 'semanticscholar'
      },
      {
        title: 'DORA: A Multi-Agent Framework for Scientific Discovery',
        authors: ['C'],
        year: 2025,
        summary: 'A multi-agent scientific discovery framework using AI agents.',
        citationCount: 30,
        source: 'semanticscholar'
      }
    ];

    const scholar = {
      async searchPapers() {
        return seedPapers;
      },
      async expandCitationGraph() {
        return snowballPapers;
      }
    } as any;

    const outline: SurveyOutline = {
      title: 'A Survey of AI Agent for Scientific Research',
      abstractDraft: 'Draft',
      taxonomy: ['Systems'],
      topicProfile: {
        originalTopic: 'AI Agent for Scientific Research',
        normalizedTopic: 'ai agent for scientific research',
        anchorTerms: ['ai', 'agent', 'scientific', 'research'],
        aliasPhrases: ['AI scientist'],
        intentFacets: ['system'],
        preferredPaperTypes: ['system'],
        sectionFacets: {}
      },
      sections: [
        {
          id: 'methods',
          title: 'Methods and Architectures',
          description: 'Technical approaches for AI agents in science.',
          searchQueries: ['AI Agent scientific research methods'],
          targetWordCount: 200
        }
      ]
    };

    const result = await retrieveSurveyPapers(
      scholar,
      'AI Agent for Scientific Research',
      outline,
      seedPapers,
      { sectionLimit: 4, perQueryLimit: 4 }
    );

    // Snowball papers should be added to the overall pool
    expect(result.papers.length).toBeGreaterThanOrEqual(seedPapers.length);
    const titles = result.papers.map((p) => p.title);
    expect(titles).toContain('DORA: A Multi-Agent Framework for Scientific Discovery');
  });

  it('should rerank benchmark and system papers according to section intent', async () => {
    const candidatePapers: Paper[] = [
      {
        title: 'The AI Scientist: Autonomous Scientific Discovery with Foundation Models',
        authors: ['A'],
        year: 2024,
        summary: 'An autonomous scientific discovery system with agentic workflows, experiment loops, and end-to-end research orchestration.',
        citationCount: 120,
        source: 'openalex'
      },
      {
        title: 'A Survey of Agentic Systems for Scientific Research',
        authors: ['B'],
        year: 2025,
        summary: 'A survey of agentic systems, workflows, and evaluation practices for scientific research.',
        citationCount: 18,
        source: 'openalex'
      },
      {
        title: 'AstaBench: Benchmarking Scientific Research Agents',
        authors: ['C'],
        year: 2025,
        summary: 'A benchmark and evaluation suite for scientific research agents with datasets, metrics, and leaderboards.',
        citationCount: 42,
        source: 'arxiv'
      },
      {
        title: 'Denario: A Multi-Agent System for Scientific Discovery',
        authors: ['D'],
        year: 2025,
        summary: 'A multi-agent platform and workflow system for autonomous scientific discovery and literature analysis.',
        citationCount: 25,
        source: 'openalex'
      }
    ];

    const scholar = {
      async searchPapers() {
        return candidatePapers;
      },
      async expandCitationGraph() {
        return [];
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
          evaluation: ['benchmark', 'evaluation', 'dataset', 'leaderboard'],
          systems: ['system', 'workflow', 'platform', 'framework']
        }
      },
      sections: [
        {
          id: 'evaluation',
          title: 'Evaluation and Benchmarks',
          description: 'Compare benchmarks, datasets, and evaluation settings.',
          searchQueries: ['AI Agent for Scientific Research benchmark'],
          targetWordCount: 200,
          focusFacets: ['benchmark', 'evaluation', 'dataset'],
          queryPlan: [
            { query: 'AI Agent for Scientific Research benchmark', facet: 'benchmark', weight: 1, source: 'base' },
            { query: 'AI scientist benchmark', facet: 'benchmark', weight: 0.95, source: 'alias' }
          ]
        },
        {
          id: 'systems',
          title: 'Applications and Systems',
          description: 'Summarize representative systems and workflow designs.',
          searchQueries: ['AI Agent for Scientific Research system'],
          targetWordCount: 200,
          focusFacets: ['system', 'workflow', 'platform'],
          queryPlan: [
            { query: 'AI Agent for Scientific Research system', facet: 'system', weight: 1, source: 'base' },
            { query: 'AI scientist system', facet: 'system', weight: 0.95, source: 'alias' }
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

    expect(result.papersBySection.evaluation[0].title).toBe('AstaBench: Benchmarking Scientific Research Agents');
    expect(result.papersBySection.systems[0].title).toBe('Denario: A Multi-Agent System for Scientific Discovery');
  });

  it('should keep foreign-domain application papers out of background-heavy sections when purer survey papers exist', async () => {
    const candidatePapers: Paper[] = [
      {
        title: 'A Survey of LLM Reasoning and Deliberation',
        authors: ['A'],
        year: 2025,
        summary: 'A survey of large language model reasoning, deliberate inference, evaluation settings, and open challenges.',
        citationCount: 40,
        source: 'openalex'
      },
      {
        title: 'Tree of Thoughts: Deliberate Problem Solving with Large Language Models',
        authors: ['B'],
        year: 2023,
        summary: 'A methods paper on deliberate search, reasoning trees, and inference-time planning for large language models.',
        citationCount: 200,
        source: 'openalex'
      },
      {
        title: 'Legal Deliberation Systems with Large Language Models',
        authors: ['C'],
        year: 2025,
        summary: 'A legal application system for judicial reasoning and deliberation support with large language models.',
        citationCount: 14,
        source: 'openalex'
      },
      {
        title: 'Clinical Deliberation with LLMs for Healthcare Decision Support',
        authors: ['D'],
        year: 2025,
        summary: 'A clinical healthcare application for deliberative reasoning and decision support using large language models.',
        citationCount: 10,
        source: 'arxiv'
      }
    ];

    const scholar = {
      async searchPapers() {
        return candidatePapers;
      },
      async expandCitationGraph() {
        return [];
      }
    } as any;

    const outline: SurveyOutline = {
      title: 'A Survey of LLM Reasoning and Deliberation',
      abstractDraft: 'Draft',
      taxonomy: ['Reasoning', 'Deliberation'],
      topicProfile: {
        originalTopic: 'LLM Reasoning and Deliberation',
        normalizedTopic: 'llm reasoning and deliberation',
        anchorTerms: ['llm', 'reasoning', 'deliberation'],
        aliasPhrases: ['large language model reasoning', 'deliberate reasoning'],
        intentFacets: ['survey', 'methods', 'evaluation'],
        preferredPaperTypes: ['survey', 'review', 'benchmark', 'system', 'framework', 'workflow'],
        sectionFacets: {
          background: ['survey', 'review', 'overview']
        }
      },
      sections: [
        {
          id: 'background',
          title: 'Background and Scope',
          description: 'Define the problem setting and survey the main landscape.',
          searchQueries: ['LLM reasoning and deliberation survey'],
          targetWordCount: 500,
          focusFacets: ['survey', 'overview'],
          queryPlan: [
            { query: 'LLM reasoning and deliberation survey', facet: 'survey', weight: 1, source: 'base' }
          ]
        }
      ]
    };

    const result = await retrieveSurveyPapers(
      scholar,
      'LLM Reasoning and Deliberation',
      outline,
      [candidatePapers[0]],
      { sectionLimit: 2, perQueryLimit: 4 }
    );

    const sectionTitles = result.papersBySection.background.map((paper) => paper.title);
    expect(sectionTitles[0]).toBe('A Survey of LLM Reasoning and Deliberation');
    expect(sectionTitles).not.toContain('Legal Deliberation Systems with Large Language Models');
    expect(sectionTitles).not.toContain('Clinical Deliberation with LLMs for Healthcare Decision Support');
  });

  it('should prefer core methods papers over foreign-domain applications in methods sections', async () => {
    const candidatePapers: Paper[] = [
      {
        title: 'Tree of Thoughts: Deliberate Reasoning and Deliberation with Large Language Models',
        authors: ['A'],
        year: 2023,
        summary: 'A methods paper on deliberate reasoning, deliberation, search trees, and inference-time planning for large language models.',
        citationCount: 200,
        source: 'openalex'
      },
      {
        title: 'Reasoning via Planning for Language Model Deliberation',
        authors: ['B'],
        year: 2025,
        summary: 'A methods and workflow paper on planning-based deliberation for large language models.',
        citationCount: 34,
        source: 'arxiv'
      },
      {
        title: 'Legal Deliberation Systems with Large Language Models',
        authors: ['C'],
        year: 2025,
        summary: 'A legal application system for judicial reasoning and deliberation support with large language models.',
        citationCount: 14,
        source: 'openalex'
      },
      {
        title: 'Clinical Deliberation with LLMs for Healthcare Decision Support',
        authors: ['D'],
        year: 2025,
        summary: 'A clinical healthcare application for deliberative reasoning and decision support using large language models.',
        citationCount: 10,
        source: 'arxiv'
      }
    ];

    const scholar = {
      async searchPapers() {
        return candidatePapers;
      },
      async expandCitationGraph() {
        return [];
      }
    } as any;

    const outline: SurveyOutline = {
      title: 'A Survey of LLM Reasoning and Deliberation',
      abstractDraft: 'Draft',
      taxonomy: ['Reasoning', 'Deliberation'],
      topicProfile: {
        originalTopic: 'LLM Reasoning and Deliberation',
        normalizedTopic: 'llm reasoning and deliberation',
        anchorTerms: ['llm', 'reasoning', 'deliberation'],
        aliasPhrases: ['large language model reasoning', 'deliberate reasoning'],
        intentFacets: ['methods', 'workflow'],
        preferredPaperTypes: ['survey', 'review', 'benchmark', 'system', 'framework', 'workflow'],
        sectionFacets: {
          methods: ['methods', 'workflow', 'planning', 'architecture']
        }
      },
      sections: [
        {
          id: 'methods',
          title: 'Core Methods',
          description: 'Summarize core reasoning, planning, and deliberation methods.',
          searchQueries: ['LLM reasoning and deliberation methods'],
          targetWordCount: 600,
          focusFacets: ['methods', 'workflow', 'planning'],
          queryPlan: [
            { query: 'LLM reasoning and deliberation methods', facet: 'methods', weight: 1, source: 'base' }
          ]
        }
      ]
    };

    const result = await retrieveSurveyPapers(
      scholar,
      'LLM Reasoning and Deliberation',
      outline,
      [candidatePapers[0]],
      { sectionLimit: 2, perQueryLimit: 4 }
    );

    const sectionTitles = result.papersBySection.methods.map((paper) => paper.title);
    expect(sectionTitles).toEqual(expect.arrayContaining([
      'Tree of Thoughts: Deliberate Reasoning and Deliberation with Large Language Models',
      'Reasoning via Planning for Language Model Deliberation'
    ]));
    expect(sectionTitles).toContain('Reasoning via Planning for Language Model Deliberation');
    expect(sectionTitles).not.toContain('Legal Deliberation Systems with Large Language Models');
    expect(sectionTitles).not.toContain('Clinical Deliberation with LLMs for Healthcare Decision Support');
  });
});
