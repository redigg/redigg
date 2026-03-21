import { describe, expect, it, vi } from 'vitest';
import HypothesisGeneratorSkill from '../../skills/02-idea/hypothesis-generator/index.js';
import GapAnalyzerSkill from '../../skills/02-idea/gap-analyzer/index.js';
import type { SkillContext } from '../../src/skills/types.js';

describe('Idea Generation Skills API Tests', () => {
  describe('HypothesisGeneratorSkill', () => {
    it('should generate hypotheses based on topic and context', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        content: '1. Hypothesis One\n2. Hypothesis Two\n3. Hypothesis Three'
      });

      const mockContext: SkillContext = {
        llm: { complete: mockComplete } as any,
        memory: {} as any,
        managers: {} as any,
        workspace: '/tmp',
        userId: 'test-user',
        log: vi.fn()
      };

      const skill = new HypothesisGeneratorSkill();
      const result = await skill.execute(mockContext, { 
        topic: 'AI Agents',
        context: 'AI agents are increasingly used for complex tasks.',
        count: 3
      });
      
      expect(mockComplete).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.hypotheses).toContain('Hypothesis One');
      expect(result.topic).toBe('AI Agents');
    });

    it('should handle llm errors gracefully', async () => {
      const mockComplete = vi.fn().mockRejectedValue(new Error('LLM Service down'));

      const mockContext: SkillContext = {
        llm: { complete: mockComplete } as any,
        memory: {} as any,
        managers: {} as any,
        workspace: '/tmp',
        userId: 'test-user',
        log: vi.fn()
      };

      const skill = new HypothesisGeneratorSkill();
      const result = await skill.execute(mockContext, { 
        topic: 'AI Agents',
        context: 'Context here'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM Service down');
    });
  });

  describe('GapAnalyzerSkill', () => {
    it('should analyze literature and output gaps', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        content: '- **Gap 1**: Lack of evaluation.\n- **Gap 2**: Poor scalability.'
      });

      const mockContext: SkillContext = {
        llm: { complete: mockComplete } as any,
        memory: {} as any,
        managers: {} as any,
        workspace: '/tmp',
        userId: 'test-user',
        log: vi.fn()
      };

      const skill = new GapAnalyzerSkill();
      const result = await skill.execute(mockContext, { 
        literature_summary: 'Lots of papers about LLM planning, but none talk about long-term horizon testing.',
        domain: 'LLM Planning'
      });
      
      expect(mockComplete).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.gaps).toContain('Lack of evaluation');
      expect(result.domain).toBe('LLM Planning');
    });

    it('should handle llm errors gracefully in gap analysis', async () => {
      const mockComplete = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));

      const mockContext: SkillContext = {
        llm: { complete: mockComplete } as any,
        memory: {} as any,
        managers: {} as any,
        workspace: '/tmp',
        userId: 'test-user',
        log: vi.fn()
      };

      const skill = new GapAnalyzerSkill();
      const result = await skill.execute(mockContext, { 
        literature_summary: 'Text here',
        domain: 'Domain here'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
  });
});
