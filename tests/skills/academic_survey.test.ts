import { describe, it, expect, vi } from 'vitest';
import AcademicSurveySelfImproveSkill from '../../skills/research/academic-survey-self-improve/index.js';
import { SkillContext } from '../../src/skills/types.js';

vi.mock('../../src/skills/lib/ScholarTool.js', () => {
  return {
    ScholarTool: class {
      async searchPapers(topic: string) {
        return [
          { title: 'Test Paper 1', year: 2024, summary: `Summary 1 about ${topic}`, authors: ['A'] },
          { title: 'Test Paper 2', year: 2023, summary: `Summary 2 about ${topic}`, authors: ['B'] }
        ];
      }
    }
  };
});

describe('AcademicSurveySelfImproveSkill', () => {
  it('should execute five-stage survey workflow successfully', async () => {
    const skill = new AcademicSurveySelfImproveSkill();

    const chat = vi.fn().mockImplementation(async (messages: { role: string; content: string }[]) => {
      const content = messages.map((message) => message.content).join('\n');

      if (content.includes('[SURVEY_OUTLINE_REQUEST]')) {
        return {
          content: JSON.stringify({
            title: 'A Survey of AI Agents',
            abstractDraft: 'This survey studies AI agents.',
            taxonomy: ['Planning', 'Tool Use', 'Evaluation'],
            sections: [
              {
                id: 'background',
                title: 'Background and Scope',
                description: 'Define AI agents and the survey scope.',
                searchQueries: ['AI agents overview', 'AI agents survey'],
                targetWordCount: 180
              },
              {
                id: 'methods',
                title: 'Core Methods',
                description: 'Summarize the main method families.',
                searchQueries: ['AI agents methods', 'AI agents planning'],
                targetWordCount: 200
              },
              {
                id: 'evaluation',
                title: 'Evaluation and Benchmarks',
                description: 'Compare evaluation setups.',
                searchQueries: ['AI agents benchmark', 'AI agents evaluation'],
                targetWordCount: 180
              }
            ]
          })
        };
      }

      if (content.includes('[SURVEY_SECTION_DRAFT]')) {
        const title = content.match(/Section title: (.+)/)?.[1]?.trim() || 'Section';
        return { content: `## ${title}\n\nThis section synthesizes the evidence for ${title.toLowerCase()} [1][2].` };
      }

      if (content.includes('[SURVEY_SECTION_REVIEW]')) {
        return {
          content: JSON.stringify({
            score: 84,
            strengths: ['Clear synthesis'],
            issues: ['Could add more benchmark detail'],
            suggestions: ['Mention benchmark variance explicitly'],
            needsRewrite: false
          })
        };
      }

      if (content.includes('[SURVEY_SECTION_REWRITE]')) {
        return { content: '## Revised Section\n\nImproved content.' };
      }

      if (content.includes('broader or more effective search query')) {
        return { content: 'AI Agents' };
      }

      return { content: 'Fallback response' };
    });

    const mockContext: SkillContext = {
      llm: { chat } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const result = await skill.execute(mockContext, { topic: 'AI Agents' });

    expect(result.success).toBe(true);
    expect(result.summary).toContain('# A Survey of AI Agents');
    expect(result.summary).toContain('## Background and Scope');
    expect(result.papers).toHaveLength(2);
    expect(result.sources).toHaveLength(2);
    expect(result.outline).not.toBeNull();
    expect(result.outline.sections).toHaveLength(3);
    expect(result.sections).toHaveLength(3);
    expect(result.quality_report).not.toBeNull();
    expect(result.quality_report.overallScore).toBe(84);
    expect(result.formatted_output).toContain('## References');
    expect(mockContext.log).toHaveBeenCalledWith('thinking', expect.stringContaining('Starting academic survey'));
  });
});
