import { describe, expect, it, vi } from 'vitest';
import DataAnalysisSkill from '../../skills/03-experiment/data-analysis/index.js';
import PlotGeneratorSkill from '../../skills/03-experiment/plot-generator/index.js';
import LatexHelperSkill from '../../skills/04-paper/latex-helper/index.js';
import type { SkillContext } from '../../src/skills/types.js';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';

vi.mock('child_process', () => ({
  exec: vi.fn((cmd, options, callback) => {
    // We handle the util.promisify version of exec
    // The test logic will override this anyway
    if (callback) callback(null, { stdout: 'mocked', stderr: '' });
  })
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('Experiment and Paper Skills API Tests', () => {
  const mockContext: SkillContext = {
    llm: { complete: vi.fn().mockResolvedValue({ content: 'Mocked completion' }) } as any,
    memory: {} as any,
    managers: {} as any,
    workspace: '/tmp',
    userId: 'test-user',
    log: vi.fn()
  };

  describe('DataAnalysisSkill', () => {
    it('should successfully execute a python data analysis script', async () => {
      // Mock child_process.exec specifically for this test
      const execMock = vi.mocked(child_process.exec).mockImplementation((cmd, options, callback: any) => {
        callback(null, { stdout: 'Mean: 42\nStd: 5', stderr: '' });
        return {} as any;
      });

      const skill = new DataAnalysisSkill();
      const result = await skill.execute(mockContext, { 
        script: 'import pandas as pd\nprint("Mean: 42\\nStd: 5")' 
      });
      
      expect(execMock).toHaveBeenCalledWith(expect.stringContaining('python3'), expect.any(Object), expect.any(Function));
      expect(result.status).toBe('success');
      expect(result.stdout).toContain('Mean: 42');
    });

    it('should fail gracefully if python script fails', async () => {
      const execMock = vi.mocked(child_process.exec).mockImplementation((cmd, options, callback: any) => {
        callback(new Error('SyntaxError: invalid syntax'), { stdout: '', stderr: 'SyntaxError: invalid syntax' });
        return {} as any;
      });

      const skill = new DataAnalysisSkill();
      const result = await skill.execute(mockContext, { 
        script: 'print("Missing parenthesis' 
      });
      
      expect(result.status).toBe('failed');
      expect(result.message).toContain('SyntaxError');
    });
  });

  describe('PlotGeneratorSkill', () => {
    it('should execute python script and verify plot was generated', async () => {
      const execMock = vi.mocked(child_process.exec).mockImplementation((cmd, options, callback: any) => {
        callback(null, { stdout: 'Plot created', stderr: '' });
        return {} as any;
      });

      // access is already mocked to resolve undefined (success) in the file level mock

      const skill = new PlotGeneratorSkill();
      const result = await skill.execute(mockContext, { 
        script: 'import matplotlib.pyplot as plt\nplt.savefig("test_plot.png")',
        output_filename: 'test_plot.png'
      });
      
      expect(execMock).toHaveBeenCalledWith(expect.stringContaining('python3'), expect.any(Object), expect.any(Function));
      expect(result.status).toBe('success');
    });
  });

  describe('LatexHelperSkill', () => {
    it('should compile latex document successfully', async () => {
      const mockExecSkill = vi.fn().mockImplementation((skillId, userId, params) => {
        if (skillId === 'shell' && params.command.includes('pdflatex')) {
          return Promise.resolve({ status: 'success', stdout: 'Output written on main.pdf' });
        }
        return Promise.resolve({ status: 'failed' });
      });

      const latexContext: SkillContext = {
        ...mockContext,
        managers: {
          skill: { executeSkill: mockExecSkill } as any
        } as any
      };

      const skill = new LatexHelperSkill();
      const result = await skill.execute(latexContext, { 
        action: 'template',
        data: 'main'
      });
      
      expect(result.status).toBe('success');
      expect(result.result).toContain('\\documentclass{article}');
    });
  });
});
