import { describe, expect, it, vi } from 'vitest';
import HypothesisGeneratorSkill from '../../skills/02-idea/hypothesis-generator/index.js';
import GapAnalyzerSkill from '../../skills/02-idea/gap-analyzer/index.js';
import PaperIdeaGeneratorSkill from '../../skills/02-idea/paper-idea-generator/index.js';
import type { SkillContext } from '../../src/skills/types.js';

// Mock fetch for arXiv
const mockArxivResponse = `
<feed>
<entry>
  <title>Test Paper about LLM Agents</title>
  <summary>This paper discusses hierarchical agent architectures.</summary>
  <published>2024-01-15</published>
  <id>http://arxiv.org/abs/1234.5678</id>
  <author><name>John Doe</name></author>
</entry>
<entry>
  <title>Another Paper on Multi-Agent Systems</title>
  <summary>Exploring peer-to-peer communication in agents.</summary>
  <published>2024-02-20</published>
  <id>http://arxiv.org/abs/2345.6789</id>
  <author><name>Jane Smith</name></author>
</entry>
</feed>
`;

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
        literature_summary: 'Lots of papers about LLM planning.',
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

  describe('PaperIdeaGeneratorSkill', () => {
    it('should generate paper ideas with arXiv papers', async () => {
      // Mock fetch for arXiv
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockArxivResponse)
      });

      const mockComplete = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          title: 'Test Idea',
          title_zh: '测试点子',
          questions: ['Question 1', 'Question 2'],
          method: 'Test methodology',
          experiments: [{ name: 'Test', dataset: 'Benchmark', baselines: ['B1'], metrics: ['M1'] }],
          contributions: ['C1'],
          resources: ['R1'],
          score: 85,
          difficulty: 'medium',
          novelty: 'moderate',
          feasibility: 'high',
          timeline: '3-6 months'
        })
      });

      const mockContext: SkillContext = {
        llm: { complete: mockComplete } as any,
        memory: {} as any,
        managers: {} as any,
        workspace: '/tmp',
        userId: 'test-user',
        log: vi.fn()
      };

      const skill = new PaperIdeaGeneratorSkill();
      const result = await skill.execute(mockContext, { 
        topic: 'LLM Agents',
        num_ideas: 2,
        max_papers: 5
      });
      
      expect(result.success).toBe(true);
      expect(result.ideas).toBeDefined();
      expect(result.papers_found).toBe(2);
      expect(result.summary).toBeDefined();
    });

    it('should handle empty arXiv results', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<feed></feed>')
      });

      const mockContext: SkillContext = {
        llm: { complete: vi.fn() } as any,
        memory: {} as any,
        managers: {} as any,
        workspace: '/tmp',
        userId: 'test-user',
        log: vi.fn()
      };

      const skill = new PaperIdeaGeneratorSkill();
      const result = await skill.execute(mockContext, { 
        topic: 'Very Obscure Topic XYZ123'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No papers found');
    });

    it('should support different languages', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockArxivResponse)
      });

      const mockComplete = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          title: 'English Title',
          title_zh: '中文标题',
          questions: ['Q'],
          method: 'Method',
          score: 80
        })
      });

      const mockContext: SkillContext = {
        llm: { complete: mockComplete } as any,
        memory: {} as any,
        managers: {} as any,
        workspace: '/tmp',
        userId: 'test-user',
        log: vi.fn()
      };

      const skill = new PaperIdeaGeneratorSkill();
      const result = await skill.execute(mockContext, { 
        topic: 'Test',
        num_ideas: 1,
        language: 'both'
      });
      
      expect(result.success).toBe(true);
      expect(result.ideas[0].title_zh).toBe('中文标题');
    });

    it('should fallback to template when LLM fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockArxivResponse)
      });

      const mockComplete = vi.fn().mockRejectedValue(new Error('LLM failed'));

      const mockContext: SkillContext = {
        llm: { complete: mockComplete } as any,
        memory: {} as any,
        managers: {} as any,
        workspace: '/tmp',
        userId: 'test-user',
        log: vi.fn()
      };

      const skill = new PaperIdeaGeneratorSkill();
      const result = await skill.execute(mockContext, { 
        topic: 'Test Topic',
        num_ideas: 1
      });
      
      expect(result.success).toBe(true);
      expect(result.ideas[0]).toBeDefined();
      expect(result.ideas[0].score).toBe(75); // Template default
    });
  });
});