import { describe, it, expect, vi } from 'vitest';
import AcademicSurveySelfImproveSkill from '../../skills/research/academic-survey-self-improve/index.js';
import { SkillContext } from '../../src/skills/types.js';

vi.mock('../../src/skills/lib/ScholarTool.js', () => {
  return {
    ScholarTool: class {
      async searchPapers(topic: string) {
        return [
          {
            title: 'A Survey of AI Agents for Scientific Workflows',
            year: 2024,
            summary: `This survey reviews ${topic}, summarizes planning and tool-use workflows, and highlights open problems for evaluation.`,
            authors: ['A']
          },
          {
            title: 'Benchmarking AI Agent Systems',
            year: 2023,
            summary: `This benchmark paper compares ${topic} systems with datasets, metrics, and evaluation settings for autonomous research agents.`,
            authors: ['B']
          }
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
        return {
          content: `## ${title}\n\nThis section synthesizes the retrieved evidence for ${title.toLowerCase()} by comparing how survey-style overviews frame the area and how benchmark-driven studies operationalize it in practice [1][2]. Across the literature, the recurring pattern is that agent systems combine planning, tool use, and evaluation loops rather than relying on a single prompting strategy, which makes the section central to understanding the field boundary and empirical maturity [1][2]. The evidence also shows that open questions remain around transferability, coverage, and reliable evaluation standards for scientific-agent workflows [1][2].\n\nA second theme is methodological integration. The survey paper emphasizes reusable workflow abstractions, while the benchmark paper turns those abstractions into measurable tasks with explicit datasets, task protocols, and success criteria [1][2]. Read together, they suggest that scientific agents are best understood as coordinated systems that connect hypothesis generation, external tools, iterative critique, and empirical validation rather than as isolated prompting tricks [1][2]. This synthesis matters because it separates enduring design patterns from implementation details and clarifies what kinds of evidence support claims about autonomous research performance [1][2].\n\nThe section also highlights where the literature is still thin. Existing studies report promising task completion results, but they leave unresolved questions about generalization across domains, robustness to noisy tools, and the human oversight required to keep research workflows reliable [1][2]. These gaps motivate stronger benchmarks, richer process traces, and more explicit reporting standards, all of which are recurring priorities in recent discussions of scientific-agent systems [1][2].`
        };
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
        return {
          content: '## Revised Section\n\nImproved content grounded in the available evidence cards with explicit citations [1][2].'
        };
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
    expect(result.outline.topicProfile.anchorTerms).toEqual(expect.arrayContaining(['agent']));
    expect(result.outline.sections[0].queryPlan.length).toBeGreaterThanOrEqual(3);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].evidenceCards.length).toBeGreaterThan(0);
    expect(result.sections[0].claimAlignments.length).toBeGreaterThan(0);
    expect(result.sections[0].evidenceCards[0].groundedClaim).toContain('A Survey of AI Agents for Scientific Workflows');
    expect(result.quality_report).not.toBeNull();
    expect(result.quality_report.overallScore).toBeGreaterThanOrEqual(70);
    expect(result.formatted_output).toContain('## References');
    expect(mockContext.log).toHaveBeenCalledWith('thinking', expect.stringContaining('Starting academic survey'));
  });
});
