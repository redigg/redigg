import { describe, expect, it, vi } from 'vitest';
import LiteratureReviewSkill from '../../skills/01-literature/literature-review/index.ts';
import type { SkillContext } from '../../src/skills/types.js';

describe('LiteratureReviewSkill', () => {
  it('should successfully orchestrate paper search and summarize results', async () => {
    const mockExecuteSkill = vi.fn().mockImplementation((skillId: string, userId: string, params: any) => {
      if (skillId === 'paper_search') {
        return Promise.resolve({
          papers: [
            { id: '123', title: 'Paper 1', authors: ['A. Author'], year: '2023', abstract: 'summary 1' },
            { id: '456', title: 'Paper 2', authors: ['B. Author'], year: '2024', abstract: 'summary 2' }
          ]
        });
      }
      if (skillId === 'local_file_ops') {
        return Promise.resolve({ status: 'success' });
      }
      return Promise.resolve({});
    });

    const mockComplete = vi.fn().mockResolvedValue({
      content: '# Executive Summary\n\nGreat papers.'
    });

    const context: SkillContext = {
      llm: { complete: mockComplete } as any,
      memory: {} as any,
      managers: {
        skill: { executeSkill: mockExecuteSkill } as any
      } as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const skill = new LiteratureReviewSkill();
    const result = await skill.execute(context, {
      topic: 'AI Agents',
      max_papers: 1
    });

    expect(mockExecuteSkill).toHaveBeenCalledWith('paper_search', 'test-user', { query: 'AI Agents', max_results: 1 });
    expect(mockComplete).toHaveBeenCalled();
    expect(mockExecuteSkill).toHaveBeenCalledWith('local_file_ops', 'test-user', expect.objectContaining({
      operation: 'write',
      path: expect.stringContaining('literature_review_ai_agents.md'),
      content: '# Executive Summary\n\nGreat papers.'
    }));

    expect(result.status).toBe('success');
    expect(result.papers_analyzed).toBe(2);
    expect(result.review).toBe('# Executive Summary\n\nGreat papers.');
  });

  it('should return failed status if no papers are found', async () => {
    const mockExecuteSkill = vi.fn().mockImplementation((skillId: string, userId: string, params: any) => {
      if (skillId === 'paper_search') {
        return Promise.resolve({ papers: [] });
      }
      return Promise.resolve({});
    });

    const context: SkillContext = {
      llm: {} as any,
      memory: {} as any,
      managers: {
        skill: { executeSkill: mockExecuteSkill } as any
      } as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: vi.fn()
    };

    const skill = new LiteratureReviewSkill();
    const result = await skill.execute(context, {
      topic: 'Unknown Topic 123',
      max_papers: 1
    });

    expect(result.status).toBe('failed');
    expect(result.message).toContain('Could not find any papers');
  });

  it('should handle search tool errors gracefully', async () => {
    const mockExecuteSkill = vi.fn().mockImplementation((skillId: string, userId: string, params: any) => {
      if (skillId === 'paper_search') {
        throw new Error('Search API is down');
      }
      if (skillId === 'local_file_ops') {
        return Promise.resolve({ status: 'success' });
      }
      return Promise.resolve({});
    });

    const mockComplete = vi.fn().mockResolvedValue({
      content: 'Review content'
    });

    const mockLog = vi.fn();

    const context: SkillContext = {
      llm: { complete: mockComplete } as any,
      memory: {} as any,
      managers: {
        skill: { executeSkill: mockExecuteSkill } as any
      } as any,
      workspace: '/tmp',
      userId: 'test-user',
      log: mockLog
    };

    const skill = new LiteratureReviewSkill();
    const result = await skill.execute(context, {
      topic: 'AI Agents',
      max_papers: 1
    });

    // Should return failed if search throws error since no papers are found
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Could not find any papers');
  });
});
