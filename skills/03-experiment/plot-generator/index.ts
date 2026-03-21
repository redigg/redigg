import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { resolvePathUnderRoot } from '../../../src/workspace/safePath.js';

const execAsync = promisify(exec);

export default class PlotGeneratorSkill implements Skill {
  id = 'plot_generator';
  name = 'Plot Generator (Matplotlib)';
  description = 'Generate publication-quality figures using Python matplotlib/seaborn.';
  tags = ['research', 'tool', 'plot', 'python'];

  parameters = {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'The Python script to generate the plot. MUST save the plot to the filename specified in the script.' },
      output_filename: { type: 'string', description: 'The expected output filename (e.g. figure1.png)' }
    },
    required: ['script', 'output_filename']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', `Generating plot: ${params.output_filename}`);
    
    try {
        const workspaceDir = ctx.workspace || process.cwd();
        const scriptPath = path.join(workspaceDir, `.redigg_plot_${Date.now()}.py`);
        const outputPath = resolvePathUnderRoot(workspaceDir, String(params.output_filename || '')).absPath;
        
        await fs.writeFile(scriptPath, params.script);
        
        ctx.log('thinking', `Executing matplotlib script...`);
        const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`, { timeout: 60000, cwd: workspaceDir });
        
        // Cleanup script
        await fs.unlink(scriptPath).catch(() => {});
        
        // Verify output was created
        try {
            await fs.access(outputPath);
            return {
                status: 'success',
                message: `Plot successfully generated at ${outputPath}`,
                file_path: outputPath,
                stdout,
                stderr
            };
        } catch {
            return {
                status: 'failed',
                message: 'Script executed but expected output file was not created.',
                stdout,
                stderr
            };
        }
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
