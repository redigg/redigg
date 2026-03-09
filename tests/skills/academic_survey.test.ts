import { describe, it, expect, vi } from 'vitest';
import AcademicSurveySelfImproveSkill from '../../skills/research/academic-survey-self-improve/index.js';
import { SkillContext } from '../../src/skills/types.js';

// Mock ScholarTool
vi.mock('../../src/skills/lib/ScholarTool.js', () => {
  return {
    ScholarTool: class {
      async searchPapers(topic: string) {
        return [
          { title: 'Test Paper 1', year: 2024, summary: 'Summary 1' },
          { title: 'Test Paper 2', year: 2023, summary: 'Summary 2' }
        ];
      }
    }
  };
});

describe('AcademicSurveySelfImproveSkill', () => {
  it('should execute survey successfully', async () => {
    const skill = new AcademicSurveySelfImproveSkill();
    
    const mockContext: SkillContext = {
      llm: {
        chat: vi.fn().mockResolvedValue({ content: 'Survey Summary' })
      } as any,
      memory: {} as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const result = await skill.execute(mockContext, { topic: 'AI Agents' });
    
    expect(result.success).toBe(true);
    expect(result.summary).toBe('Survey Summary');
    expect(result.papers).toHaveLength(2);
    expect(mockContext.log).toHaveBeenCalledWith('thinking', expect.stringContaining('Starting academic survey'));
  });
});
