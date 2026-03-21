import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent } from '../../src/agent/ResearchAgent.js';
import { MemoryManager } from '../../src/memory/MemoryManager.js';
import { MemoryEvolutionSystem } from '../../src/memory/evolution/MemoryEvolutionSystem.js';
import { MockLLMClient } from '../../src/llm/LLMClient.js';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import fs from 'fs';
import path from 'path';

vi.mock('../../skills/01-literature/paper-search/ScholarTool.js', () => {
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
          content: JSON.stringify({
            intent: 'single',
            steps: [
              {
                id: '1',
                description: 'Run literature review',
                tool: 'literature_review',
                params: { topic: 'reasoning in LLMs' }
              }
            ]
          })
        };
      }

      if (content.includes('Do a literature review on reasoning in LLMs')) {
        // Return tool calls for literature review instead of direct response
        return {
          content: '',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'literature_review',
              arguments: JSON.stringify({ topic: 'reasoning in LLMs' })
            }
          }]
        };
      } else if (content.includes('Here is a literature review')) {
          return { content: 'Here is a literature review on "reasoning in LLMs"\n# Survey of reasoning\n## Background and Scope\n**Sources:**' };
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

    // Mock the skill execution to add papers to memory
    vi.spyOn(agent.skillManager, 'executeSkill').mockResolvedValue({
      success: true,
      result: 'Survey completed',
      papers: [{ title: 'Test Paper', authors: ['Author'], year: 2024 }]
    } as any);

    // Mock the memory manager to return papers
    vi.spyOn(memoryManager, 'getUserMemories').mockResolvedValue([
      {
        id: 'test-paper-1',
        userId: 'user1',
        type: 'paper',
        content: JSON.stringify({ title: 'Test Paper', authors: ['Author'], year: 2024 }),
        weight: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ] as any);

    const reply = await agent.chat('user1', 'Do a literature review on reasoning in LLMs');

    expect(reply).toBeDefined();
    expect(chatSpy).toHaveBeenCalled();
    expect(agent.skillManager.executeSkill).toHaveBeenCalled();
    expect(memoryManager.getUserMemories).toHaveBeenCalled();
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

    let callCount = 0;
    vi.spyOn(llm, 'chat').mockImplementation(async (messages: { role: string; content: string }[]) => {
      callCount++;
      const content = messages.map((message) => message.content).join('\n');

      // First call: return tool calls for literature review
      if (callCount === 1 && content.includes('Conduct a literature review on AI Agent for Scientific Research')) {
        return {
          content: '',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'literature_review',
              arguments: JSON.stringify({ topic: 'AI Agent for Scientific Research' })
            }
          }]
        };
      }
      // Second call: return tool calls for PDF generation
      else if (callCount === 2) {
        return {
          content: '',
          tool_calls: [{
            id: 'call_2',
            type: 'function',
            function: {
              name: 'pdf_generator',
              arguments: JSON.stringify({
                title: 'Literature Review on AI Agent for Scientific Research',
                content: '# A Survey of AI Agent for Scientific Research\n\nThis is a survey.'
              })
            }
          }]
        };
      }
      // Final response: return the PDF link message after both tool calls are completed
      else if (callCount >= 3) {
        return {
          content: 'I generated the literature review PDF.\n\n[Literature Review on AI Agent for Scientific Research.pdf](http://localhost:4000/files/pdfs/literature-review.pdf)'
        };
      }

      return { content: 'Fallback response' };
    });

    const reply = await agent.chat('user1', 'Conduct a literature review on AI Agent for Scientific Research and generate a PDF.');

    expect(reply).toContain('Literature Review on AI Agent for Scientific Research.pdf');
    expect(capturedPdfContent).toContain('# A Survey of AI Agent for Scientific Research');
    expect(capturedPdfContent).not.toContain('Generated based on literature review findings');
  });

  it('should execute literature review skill and process results', async () => {
    // Mock LLM to return tool calls for literature review
    vi.spyOn(llm, 'chat').mockImplementation(async (messages: { role: string; content: string }[]) => {
      const content = messages.map((message) => message.content).join('\n');
      
      if (content.includes('Do a literature review on AI Agent for Scientific Research')) {
        return {
          content: '',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'literature_review',
              arguments: JSON.stringify({ topic: 'AI Agent for Scientific Research' })
            }
          }]
        };
      }
      return { content: 'I processed the literature review results.' };
    });

    // Mock the skill execution
    vi.spyOn(agent.skillManager, 'executeSkill').mockResolvedValue({
      status: 'success',
      summary: '# Seed Survey\n\nInitial survey draft from literature_review.',
      formatted_output: '# Seed Survey\n\nInitial survey draft from literature_review.',
      papers: [{ title: 'Seed Paper', year: 2025 }],
      sections: [{ title: 'Background and Scope' }],
      quality_report: { overallScore: 83 }
    } as any);

    const reply = await agent.chat('user1', 'Do a literature review on AI Agent for Scientific Research');

    expect(reply).toBeDefined();
    expect(agent.skillManager.executeSkill).toHaveBeenCalled();
  });
});
