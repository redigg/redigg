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

  it('should clamp low section word targets to the depth minimums', async () => {
    const context: SkillContext = {
      llm: {
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            title: 'A Survey of AI Agents',
            abstractDraft: 'This survey studies AI agents.',
            taxonomy: ['Planning', 'Tool Use', 'Evaluation'],
            sections: [
              {
                id: 'background',
                title: 'Background and Scope',
                description: 'Define AI agents and the survey scope.',
                searchQueries: ['AI agents overview'],
                targetWordCount: 200
              },
              {
                id: 'methods',
                title: 'Core Methods',
                description: 'Summarize the main method families.',
                searchQueries: ['AI agents methods'],
                targetWordCount: 200
              },
              {
                id: 'evaluation',
                title: 'Evaluation and Benchmarks',
                description: 'Compare evaluation setups.',
                searchQueries: ['AI agents benchmark'],
                targetWordCount: 200
              },
              {
                id: 'applications',
                title: 'Applications and Systems',
                description: 'Review application settings.',
                searchQueries: ['AI agents applications'],
                targetWordCount: 200
              },
              {
                id: 'challenges',
                title: 'Open Challenges and Future Directions',
                description: 'Identify open challenges.',
                searchQueries: ['AI agents challenges'],
                targetWordCount: 200
              }
            ]
          })
        })
      } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const outline = await createSurveyOutline(
      context,
      'AI Agents',
      [
        {
          title: 'A Survey of AI Agents for Scientific Workflows',
          authors: ['A'],
          year: 2024,
          summary: 'Autonomous research agents.'
        }
      ],
      'standard'
    );

    const backgroundSection = outline.sections.find((section) => section.title === 'Background and Scope');
    const methodsSection = outline.sections.find((section) => section.title === 'Core Methods');
    const evaluationSection = outline.sections.find((section) => section.title === 'Evaluation and Benchmarks');

    // B4: Word counts are clamped to depth floors AND then scaled up to meet total word floor (6000 for standard)
    expect(backgroundSection?.targetWordCount).toBeGreaterThanOrEqual(1000);
    expect(methodsSection?.targetWordCount).toBeGreaterThanOrEqual(1200);
    expect(evaluationSection?.targetWordCount).toBeGreaterThanOrEqual(1000);
    expect(outline.sections.every((section) => section.targetWordCount >= 1000)).toBe(true);
    // Total should meet the B4 floor
    const totalWords = outline.sections.reduce((sum, s) => sum + s.targetWordCount, 0);
    expect(totalWords).toBeGreaterThanOrEqual(6000);
  });
});
