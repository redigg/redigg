import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent } from '../../src/agent/ResearchAgent.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../src/memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

vi.mock('../../src/skills/lib/ScholarTool.js', () => {
  return {
    ScholarTool: class {
      async searchPapers(topic: string) {
        return [
          {
            title: `A Survey of ${topic}`,
            year: 2024,
            summary: `This survey reviews ${topic}, organizes the field into methodological families, and discusses how planning, tool use, and evaluation interact in end-to-end research workflows.`,
            url: 'https://example.com/1',
            authors: ['A']
          },
          {
            title: `Benchmarking ${topic} Systems`,
            year: 2023,
            summary: `This benchmark paper compares ${topic} systems with explicit datasets, benchmark tasks, and evaluation metrics for autonomous scientific-agent pipelines.`,
            url: 'https://example.com/2',
            authors: ['B']
          }
        ];
      }
    }
  };
});

describe('ResearchAgent - Skills', () => {
  let memoryManager: MemoryManager;
  let dbPath: string;
  let llm: MockLLMClient;
  let memoryEvo: MemoryEvolutionSystem;
  let agent: ResearchAgent;

  beforeEach(async () => {
    dbPath = path.join(process.cwd(), 'data', 'test-agent-skill.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const storage = new SQLiteStorage(dbPath);
    memoryManager = new MemoryManager(storage);
    llm = new MockLLMClient();
    memoryEvo = new MemoryEvolutionSystem(memoryManager, llm);
    agent = new ResearchAgent(memoryManager, memoryEvo, llm);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should detect intent and execute literature review skill', async () => {
    const chatSpy = vi.spyOn(llm, 'chat').mockImplementation(async (messages: { role: string; content: string }[]) => {
      const system = messages[0]?.content || '';
      const content = messages.map((message) => message.content).join('\n');

      if (system.includes('You are a strict QA evaluator.')) {
        return {
          content: JSON.stringify({
            score: 86,
            reasoning: 'Good review.',
            suggestions: ['Add more benchmark granularity if needed.'],
            passed: true
          })
        };
      }

      if (content.includes('Return a JSON plan:')) {
        return {
          content: JSON.stringify({ intent: 'single', steps: [] })
        };
      }

      if (content.includes('[SURVEY_OUTLINE_REQUEST]')) {
        return {
          content: JSON.stringify({
            title: 'A Survey of reasoning in LLMs',
            abstractDraft: 'This survey summarizes reasoning in LLMs.',
            taxonomy: ['Reasoning', 'Planning', 'Evaluation'],
            sections: [
              {
                id: 'background',
                title: 'Background and Scope',
                description: 'Define the reasoning problem setting.',
                searchQueries: ['reasoning in LLMs overview', 'reasoning in LLMs survey'],
                targetWordCount: 180
              },
              {
                id: 'methods',
                title: 'Core Methods',
                description: 'Summarize the main method families.',
                searchQueries: ['reasoning in LLMs methods', 'reasoning in LLMs planning'],
                targetWordCount: 200
              },
              {
                id: 'evaluation',
                title: 'Evaluation and Benchmarks',
                description: 'Compare evaluation setups.',
                searchQueries: ['reasoning in LLMs benchmark', 'reasoning in LLMs evaluation'],
                targetWordCount: 180
              }
            ]
          })
        };
      }

      if (content.includes('[SURVEY_SECTION_DRAFT]')) {
        const title = content.match(/Section title: (.+)/)?.[1]?.trim() || 'Section';
        return {
          content: `## ${title}\n\nThis section synthesizes the retrieved evidence for ${title.toLowerCase()} by comparing how survey-oriented overviews frame the research space and how benchmark-oriented studies operationalize it with concrete tasks, metrics, and workflows [1][2]. Across the literature, the consistent pattern is that scientific-agent systems rely on iterative planning, tool use, and evidence tracking rather than a single prompting trick, which makes the section central to understanding both capability and limitation boundaries [1][2]. The section also highlights that evaluation remains a bottleneck because benchmark design, reproducibility, and cross-domain transfer all remain unresolved in current systems [1][2].`
        };
      }

      if (content.includes('[SURVEY_SECTION_REVIEW]')) {
        return {
          content: JSON.stringify({
            score: 82,
            strengths: ['Grounded in retrieved papers'],
            issues: ['Could use slightly more synthesis'],
            suggestions: ['State the main trade-off more explicitly.'],
            needsRewrite: false
          })
        };
      }

      if (content.includes('[SURVEY_SECTION_REWRITE]')) {
        return { content: '## Revised Section\n\nImproved survey section.' };
      }

      if (content.includes('Analyze the following interaction between a User and an AI Assistant.')) {
        return { content: JSON.stringify({ memories: [] }) };
      }

      if (content.includes('Summarize the following conversation into a short, 3-5 word title')) {
        return { content: 'Reasoning Survey' };
      }

      if (content.includes('broader or more effective search query')) {
        return { content: 'reasoning in LLMs' };
      }

      return { content: 'I am a mock LLM.' };
    });

    const reply = await agent.chat('user1', 'Do a literature review on reasoning in LLMs');

    expect(reply).toContain('Here is a literature review on "reasoning in LLMs"');
    expect(reply).toContain('# A Survey of reasoning in LLMs');
    expect(reply).toContain('## Background and Scope');
    expect(reply).toContain('**Sources:**');
    expect(chatSpy).toHaveBeenCalled();

    const papers = await memoryManager.getUserMemories('user1', 'paper');
    expect(papers.length).toBeGreaterThan(0);
  });

  it('should reuse literature review output when generating a PDF from a planned workflow', async () => {
    let capturedPdfContent = '';
    const originalExecuteSkill = agent.skillManager.executeSkill.bind(agent.skillManager);

    vi.spyOn(agent.skillManager, 'executeSkill').mockImplementation(async (skillId: string, userId: string, params: any, callbacks?: any) => {
      if (skillId === 'pdf_generator') {
        capturedPdfContent = params.content;
        return {
          success: true,
          file_path: '/tmp/literature-review.pdf',
          url: '/files/pdfs/literature-review.pdf',
          formatted_output: '### PDF Generated\n\n[Download PDF](/files/pdfs/literature-review.pdf)'
        } as any;
      }

      return originalExecuteSkill(skillId, userId, params, callbacks);
    });

    vi.spyOn(llm, 'chat').mockImplementation(async (messages: { role: string; content: string }[]) => {
      const system = messages[0]?.content || '';
      const content = messages.map((message) => message.content).join('\n');

      if (content.includes('Return a JSON plan:')) {
        return {
          content: JSON.stringify({
            intent: 'multi_step',
            steps: [
              {
                id: '1',
                description: 'Run literature review',
                tool: 'LiteratureReview',
                params: { topic: 'AI Agent for Scientific Research' }
              },
              {
                id: '2',
                description: 'Generate a PDF report',
                tool: 'PdfGenerator',
                params: {
                  title: 'Literature Review on AI Agent for Scientific Research',
                  content: 'Generated based on literature review findings'
                }
              },
              {
                id: '3',
                description: 'Return the generated file',
                tool: 'Chat',
                params: { message: 'Share the generated literature review PDF.' }
              }
            ]
          })
        };
      }

      if (system.includes('You are a strict QA evaluator.')) {
        return {
          content: JSON.stringify({
            score: 88,
            reasoning: 'Good review.',
            suggestions: ['Expand quantitative comparisons if needed.'],
            passed: true
          })
        };
      }

      if (content.includes('[SURVEY_OUTLINE_REQUEST]')) {
        return {
          content: JSON.stringify({
            title: 'A Survey of AI Agent for Scientific Research',
            abstractDraft: 'This survey summarizes AI agents for scientific research.',
            taxonomy: ['Background', 'Methods', 'Evaluation'],
            sections: [
              {
                id: 'background',
                title: 'Background and Scope',
                description: 'Define the research scope.',
                searchQueries: ['AI agent for scientific research overview'],
                targetWordCount: 180
              },
              {
                id: 'methods',
                title: 'Core Methods',
                description: 'Summarize methods.',
                searchQueries: ['AI agent for scientific research methods'],
                targetWordCount: 200
              },
              {
                id: 'evaluation',
                title: 'Evaluation and Benchmarks',
                description: 'Summarize benchmarks.',
                searchQueries: ['AI agent for scientific research benchmarks'],
                targetWordCount: 180
              }
            ]
          })
        };
      }

      if (content.includes('[SURVEY_SECTION_DRAFT]')) {
        const title = content.match(/Section title: (.+)/)?.[1]?.trim() || 'Section';
        return {
          content: `## ${title}\n\nThis section synthesizes grounded evidence for ${title.toLowerCase()} by combining survey-style framing with benchmark and system papers that describe how scientific-agent workflows are built, evaluated, and stress-tested in practice [1][2]. The key synthesis is that recent systems move beyond isolated prompting setups toward multi-step planning, tool invocation, and benchmark-driven evaluation loops, while still facing open issues around reliability, coverage, and domain transfer [1][2]. These observations make the section suitable for a survey-style PDF report grounded in explicit references rather than placeholder text [1][2].`
        };
      }

      if (content.includes('[SURVEY_SECTION_REVIEW]')) {
        return {
          content: JSON.stringify({
            score: 81,
            strengths: ['Grounded and concise'],
            issues: ['Could add more synthesis'],
            suggestions: ['State one methodological trade-off more clearly.'],
            needsRewrite: false
          })
        };
      }

      if (content.includes('Share the generated literature review PDF.')) {
        return {
          content: 'I generated the literature review PDF.\n\n[Literature Review on AI Agent for Scientific Research.pdf](http://localhost:4000/files/pdfs/literature-review.pdf)'
        };
      }

      if (content.includes('Summarize the following conversation into a short, 3-5 word title')) {
        return { content: 'Scientific Research Survey' };
      }

      return { content: 'Fallback response' };
    });

    const reply = await agent.chat('user1', 'Conduct a literature review on AI Agent for Scientific Research and generate a PDF.');

    expect(reply).toContain('Literature Review on AI Agent for Scientific Research.pdf');
    expect(capturedPdfContent).toContain('# A Survey of AI Agent for Scientific Research');
    expect(capturedPdfContent).not.toContain('Generated based on literature review findings');
  });

  it('should seed AutoResearch with survey skill output before iterative rewriting', async () => {
    const session = agent.sessionManager.createSession('user1');
    let stopChecks = 0;
    let capturedPdfContent = '';
    let sawSeedSurveyInRewritePrompt = false;
    const originalExecuteSkill = agent.skillManager.executeSkill.bind(agent.skillManager);

    vi.spyOn(agent.sessionManager, 'isSessionStopped').mockImplementation(() => {
      stopChecks += 1;
      return stopChecks >= 3;
    });

    vi.spyOn(agent.skillManager, 'executeSkill').mockImplementation(async (skillId: string, userId: string, params: any, callbacks?: any) => {
      if (skillId === 'academic_survey_self_improve') {
        return {
          success: true,
          summary: '# Seed Survey\n\nInitial survey draft from academic_survey_self_improve.',
          formatted_output: '# Seed Survey\n\nInitial survey draft from academic_survey_self_improve.',
          papers: [{ title: 'Seed Paper', year: 2025 }],
          sections: [{ title: 'Background and Scope' }],
          quality_report: { overallScore: 83 }
        } as any;
      }

      if (skillId === 'pdf_generator') {
        capturedPdfContent = params.content;
        return {
          success: true,
          file_path: '/tmp/auto-seed.pdf',
          url: '/files/pdfs/auto-seed.pdf',
          formatted_output: '### PDF Generated\n\n[Download PDF](/files/pdfs/auto-seed.pdf)'
        } as any;
      }

      return originalExecuteSkill(skillId, userId, params, callbacks);
    });

    vi.spyOn(llm, 'chat').mockImplementation(async (messages: { role: string; content: string }[]) => {
      const content = messages.map((message) => message.content).join('\n');

      if (content.includes('Identify ONE specific area to improve')) {
        return { content: 'Add a short case study.' };
      }

      if (content.includes('Perform the task and rewrite the FULL content to include the new information.')) {
        if (content.includes('# Seed Survey')) {
          sawSeedSurveyInRewritePrompt = true;
        }
        return { content: '# Revised Survey\n\nThis revision builds on the seeded survey draft and adds a case study.' };
      }

      return { content: 'Fallback response' };
    });

    const result = await (agent as any).executeStep(
      { tool: 'AutoResearch', params: { topic: 'AI Agent for Scientific Research' } },
      'user1',
      session,
      vi.fn(),
      undefined,
      [],
      []
    );

    expect(result.output).toContain('Auto-research completed/stopped');
    expect(sawSeedSurveyInRewritePrompt).toBe(true);
    expect(capturedPdfContent).toContain('# Revised Survey');
  });
});
