import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default class ShellSkill implements Skill {
  id = 'shell';
  name = 'Shell Executor';
  description = 'Execute safe shell commands in the workspace environment.';
  tags = ['system', 'tool', 'shell'];

  parameters = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' }
    },
    required: ['command']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', `Executing shell command: ${params.command}`);
    
    // WARNING: In a real production environment, this should be executed in a secure sandbox/docker container.
    // For this prototype, we'll execute it directly but you should add command filtering.
    
    const blockedCommands = ['rm -rf /', 'mkfs', 'dd if='];
    if (blockedCommands.some(cmd => params.command.includes(cmd))) {
        return { success: false, error: 'Command rejected for security reasons.' };
    }

    try {
      const { stdout, stderr } = await execAsync(params.command, { 
          cwd: ctx.workspace || process.cwd(),
          timeout: 30000 // 30 second timeout
      });
      
      return { 
        status: 'success',
        message: `Command executed successfully.`,
        stdout: stdout || undefined,
        stderr: stderr || undefined
      };
    } catch (error: any) {
      return {
        status: 'failed',
        error: `Command failed: ${error.message}`,
        stdout: error.stdout,
        stderr: error.stderr
      };
    }
  }
}
