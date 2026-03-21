import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const DANGEROUS_PATTERNS = [
  /import\s+(os|subprocess|socket|urllib|requests|httplib|ftplib|poplib|imaplib|smtplib|telnetlib|pty|resource|sys|io\.open)/i,
  /from\s+(os|subprocess|socket|urllib|requests|httplib|ftplib|poplib|imaplib|smtplib|telnetlib|pty|resource|sys)\s+import/i,
  /__import__/,
  /exec\s*\(/,
  /eval\s*\(/,
  /open\s*\([^)]*['\"](?:etc|proc|sys|usr\/bin|bin|lib|dev)\//i,
  /os\.system/,
  /os\.popen/,
  /subprocess\.call/,
  /subprocess\.run/,
  /subprocess\.Popen/,
  /compile\s*\(/,
  /setattr\s*\(/,
  /getattr\s*\(/,
  /delattr\s*\(/,
];

const ALLOWED_REQUIREMENTS = ['pandas', 'numpy', 'scipy', 'scikit-learn', 'sklearn', 'matplotlib', 'seaborn', 'statsmodels', 'sympy', 'numba', 'joblib'];

function validateScript(script: string): { valid: boolean; reason?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(script)) {
      return { valid: false, reason: `Script contains forbidden pattern: ${pattern}` };
    }
  }
  return { valid: true };
}

function validateRequirements(requirements: string[]): { valid: boolean; reason?: string } {
  for (const req of requirements) {
    const normalized = req.toLowerCase().trim().split(/[>=<!]/)[0];
    if (!ALLOWED_REQUIREMENTS.includes(normalized)) {
      return { valid: false, reason: `Module "${req}" is not allowed. Allowed: ${ALLOWED_REQUIREMENTS.join(', ')}` };
    }
  }
  return { valid: true };
}

export default class DataAnalysisSkill implements Skill {
  id = 'data_analysis';
  name = 'Data Analysis (Python)';
  description = 'Run Python scripts for statistical analysis (pandas, numpy, scipy).';
  tags = ['research', 'tool', 'data', 'python'];

  parameters = {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'The Python script to execute' },
      requirements: { type: 'array', items: { type: 'string' }, description: 'Pip packages required (e.g. ["pandas", "numpy"])' }
    },
    required: ['script']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', `Preparing Python data analysis script.`);

    const validation = validateScript(params.script);
    if (!validation.valid) {
      ctx.log('error', `Script validation failed: ${validation.reason}`);
      return {
        status: 'failed',
        message: validation.reason
      };
    }

    if (params.requirements) {
      const reqValidation = validateRequirements(params.requirements);
      if (!reqValidation.valid) {
        ctx.log('error', `Requirements validation failed: ${reqValidation.reason}`);
        return {
          status: 'failed',
          message: reqValidation.reason
        };
      }
    }

    try {
      const workspaceDir = ctx.workspace || process.cwd();
      const scriptPath = path.join(workspaceDir, `.redigg_analysis_${Date.now()}.py`);

      await fs.writeFile(scriptPath, params.script);

      ctx.log('thinking', `Executing Python script...`);
      const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`, { timeout: 60000, cwd: workspaceDir });

      await fs.unlink(scriptPath).catch(() => {});

      return {
        status: 'success',
        stdout,
        stderr
      };
    } catch (error: any) {
      return {
        status: 'failed',
        message: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      };
    }
  }
}