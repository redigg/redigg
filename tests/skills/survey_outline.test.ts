import { describe, expect, it, vi } from 'vitest';
import { createSurveyOutline } from '../../skills/research/academic-survey-self-improve/outline.js';
import type { SkillContext } from '../../src/skills/types.js';

describe('createSurveyOutline', () => {
  it('should build a topic profile and expanded query plan for scientific agent topics', async () => {
    const context: SkillContext = {
      llm: {
        chat: vi.fn().mockResolvedValue({
          content: 'not valid json'
        })
      } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const outline = await createSurveyOutline(
      context,
      'AI Agent for Scientific Research',
      [
        {
          title: 'The AI Scientist',
          authors: ['A'],
          year: 2024,
          summary: 'Autonomous scientific discovery systems.'
        }
      ],
      'standard'
    );

    expect(outline.topicProfile?.anchorTerms).toEqual(
      expect.arrayContaining(['ai', 'agent', 'scientific', 'research'])
    );
    expect(outline.topicProfile?.aliasPhrases).toContain('AI scientist');

    const evaluationSection = outline.sections.find((section) => section.title === 'Evaluation and Benchmarks');
    expect(evaluationSection).toBeDefined();
    expect(evaluationSection?.focusFacets).toEqual(
      expect.arrayContaining(['benchmark', 'evaluation'])
    );
    expect(evaluationSection?.queryPlan?.map((item) => item.query)).toEqual(
      expect.arrayContaining([
        'AI Agent for Scientific Research benchmark',
        'AI scientist benchmark'
      ])
    );
  });
});
