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
          { title: 'Reasoning Paper 1', year: 2024, summary: `Summary 1 about ${topic}`, url: 'https://example.com/1', authors: ['A'] },
          { title: 'Reasoning Paper 2', year: 2023, summary: `Summary 2 about ${topic}`, url: 'https://example.com/2', authors: ['B'] }
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
          content: `## ${title}\n\nThis section synthesizes reasoning-in-LLM evidence for ${title.toLowerCase()} [1][2].`
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
});
