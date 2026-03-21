import { describe, expect, it, vi } from 'vitest';
import FigureGeneratorSkill from '../../skills/04-paper/figure-generator/index.ts';
import type { SkillContext } from '../../src/skills/types.js';

describe('FigureGeneratorSkill', () => {
  it('should generate python script and verify file creation successfully', async () => {
    const mockExecuteSkill = vi.fn().mockImplementation((skillId: string, userId: string, params: any) => {
      if (skillId === 'plot_generator') {
        return Promise.resolve({
          message: 'Plot generated'
        });
      }
      if (skillId === 'shell') {
        return Promise.resolve({
          stdout: '-rw-r--r-- 1 user group 1024 Jan 1 00:00 test_plot.png\n'
        });
      }
      return Promise.resolve({});
    });

    const mockComplete = vi.fn().mockResolvedValue({
      content: '```python\nimport matplotlib.pyplot as plt\n```'
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

    const skill = new FigureGeneratorSkill();
    const result = await skill.execute(context, {
      title: 'Performance Comparison',
      description: 'Bar chart showing agent vs human',
      filename: 'test_plot.png'
    });

    expect(mockComplete).toHaveBeenCalled();
    expect(mockExecuteSkill).toHaveBeenCalledWith('plot_generator', 'test-user', expect.objectContaining({
      script: expect.stringContaining('import matplotlib')
    }));
    expect(mockExecuteSkill).toHaveBeenCalledWith('shell', 'test-user', { command: 'ls -la test_plot.png' });

    expect(result.status).toBe('success');
    expect(result.file).toBe('test_plot.png');
  });

  it('should return failed status if output file is not found', async () => {
    const mockExecuteSkill = vi.fn().mockImplementation((skillId: string, userId: string, params: any) => {
      if (skillId === 'plot_generator') {
        return Promise.resolve({
          message: 'Plot generated'
        });
      }
      if (skillId === 'shell') {
        return Promise.resolve({
          stdout: '',
          stderr: 'ls: test_plot.png: No such file or directory\n'
        });
      }
      return Promise.resolve({});
    });

    const mockLog = vi.fn();
    const mockComplete = vi.fn().mockResolvedValue({ content: 'print(1)' });

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

    const skill = new FigureGeneratorSkill();
    const result = await skill.execute(context, {
      title: 'Performance Comparison',
      description: 'Bar chart showing agent vs human',
      filename: 'test_plot.png'
    });

    expect(mockLog).toHaveBeenCalledWith('error', expect.stringContaining('output file was not found'));
    expect(result.status).toBe('failed');
    expect(result.message).toContain('output file was not found');
  });

  it('should handle llm completion errors gracefully', async () => {
    const mockExecuteSkill = vi.fn().mockImplementation((skillId: string, userId: string, params: any) => {
      return Promise.resolve({});
    });

    const mockLog = vi.fn();
    const mockComplete = vi.fn().mockRejectedValue(new Error('LLM Service down'));

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

    const skill = new FigureGeneratorSkill();
    const result = await skill.execute(context, {
      title: 'Performance Comparison',
      description: 'Bar chart showing agent vs human',
      filename: 'test_plot.png'
    });

    expect(result.status).toBe('failed');
    expect(result.message).toContain('LLM Service down');
  });
});
