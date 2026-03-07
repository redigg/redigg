import { Skill, SkillContext } from './index';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { webSearch } from '../utils/web-search';

import { promptManager } from '../utils/prompt-manager';

export const GeneralSkill: Skill = {
  name: 'general',
  description: 'General purpose autonomous agent with file system access and research capabilities',
  execute: async (ctx: SkillContext, params: any) => {
    const WORKSPACE_ROOT = ctx.workspace || path.join(homedir(), '.redigg', 'workspace');
    if (!fs.existsSync(WORKSPACE_ROOT)) {
      fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
    }

    const instruction = params?.instruction || params?.topic || 'Perform the requested task';
    const history = params?.history || [];
    
    await ctx.log('thinking', `Starting general task: ${instruction}`);

    const tools = [
      // ... (tools remain the same)

      {
        type: 'function',
        function: {
          name: 'list_files',
          description: 'List files in the workspace directory',
          parameters: {
            type: 'object',
            properties: {
              dir: { type: 'string', description: 'Directory relative to workspace root (default: .)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read content of a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path relative to workspace root' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Write content to a file (overwrites existing)',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path relative to workspace root' },
              content: { type: 'string', description: 'Content to write' }
            },
            required: ['path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for real-time information (e.g. latest news, docs)',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'run_terminal_command',
          description: 'Execute a shell command in the workspace',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The command to execute' },
              cwd: { type: 'string', description: 'Working directory relative to workspace root (default: .)' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_available_skills',
          description: 'List all available specialized skills that can be delegated to',
          parameters: { type: 'object', properties: {} }
        }
      },
      {
        type: 'function',
        function: {
          name: 'run_skill',
          description: 'Delegate a task to a specialized skill',
          parameters: {
            type: 'object',
            properties: {
              skill_name: { 
                  type: 'string', 
                  description: 'The name of the skill to run (use list_available_skills to find names)'
              },
              params: { 
                  type: 'object',
                  description: 'Parameters for the skill (e.g. topic, context)'
              }
            },
            required: ['skill_name', 'params']
          }
        }
      }
    ];

    const messages = [
      { 
        role: 'system', 
        content: promptManager.get('general', { WORKSPACE_ROOT, instruction })
      },
      ...history.map((h: string) => ({ role: 'user', content: h })),
      { role: 'user', content: instruction }
    ];

    let loopCount = 0;
    const MAX_LOOPS = 10;

    while (loopCount < MAX_LOOPS) {
      loopCount++;
      
      // Call LLM with tools
      const response = await ctx.llm.generateCompletion(
        messages, 
        (token: string, type: 'content' | 'reasoning' = 'content') => {
            if (type === 'reasoning') {
                ctx.log('reasoning_token', token);
            } else {
                ctx.log('token', token);
            }
        }, 
        tools
      );
      const message = response;

      messages.push(message);

      if (message.content) {
        await ctx.log('thinking', message.content);
      }

      if (!message.tool_calls || message.tool_calls.length === 0) {
        // Final answer
        return {
          summary: message.content,
          reply: message.content
        };
      }

      // Handle tool calls
      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result = '';

        await ctx.log('action', `Executing ${fnName}...`);

        try {
          if (fnName === 'list_files') {
            const targetDir = path.resolve(WORKSPACE_ROOT, args.dir || '.');
            if (!targetDir.startsWith(WORKSPACE_ROOT)) throw new Error('Access denied: Path outside workspace');
            if (fs.existsSync(targetDir)) {
                const files = fs.readdirSync(targetDir);
                result = `Files in ${args.dir || '.'}:\n${files.join('\n')}`;
            } else {
                result = `Directory not found: ${args.dir}`;
            }
          } else if (fnName === 'read_file') {
            const targetPath = path.resolve(WORKSPACE_ROOT, args.path);
            if (!targetPath.startsWith(WORKSPACE_ROOT)) throw new Error('Access denied: Path outside workspace');
            if (fs.existsSync(targetPath)) {
                result = fs.readFileSync(targetPath, 'utf-8');
            } else {
                result = `File not found: ${args.path}`;
            }
          } else if (fnName === 'write_file') {
            const targetPath = path.resolve(WORKSPACE_ROOT, args.path);
            if (!targetPath.startsWith(WORKSPACE_ROOT)) throw new Error('Access denied: Path outside workspace');
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(targetPath, args.content);
            result = `Successfully wrote to ${args.path}`;
            await ctx.log('tool_result', `Created file: ${args.path}`);
          } else if (fnName === 'web_search') {
            await ctx.log('action', `Searching: ${args.query}`);
            result = await webSearch(args.query);
          } else if (fnName === 'run_terminal_command') {
            const targetDir = path.resolve(WORKSPACE_ROOT, args.cwd || '.');
            if (!targetDir.startsWith(WORKSPACE_ROOT)) throw new Error('Access denied: Path outside workspace');
            
            await ctx.log('action', `Running: ${args.command}`);
            
            result = await new Promise((resolve) => {
                exec(args.command, { cwd: targetDir, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                    let output = '';
                    if (stdout) output += `STDOUT:\n${stdout}\n`;
                    if (stderr) output += `STDERR:\n${stderr}\n`;
                    if (error) output += `ERROR:\n${error.message}\n`;
                    resolve(output || 'Command executed with no output.');
                });
            });
          } else if (fnName === 'list_available_skills') {
             if (ctx.listSkills) {
                 const skills = await ctx.listSkills();
                 result = `Available Skills:\n${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}`;
             } else {
                 result = "Error: Skill listing not available in this context.";
             }
          } else if (fnName === 'run_skill' || fnName === 'run_research_skill') {
             if (ctx.invokeSkill) {
                 await ctx.log('action', `Delegating to ${args.skill_name}...`);
                 const skillResult = await ctx.invokeSkill(args.skill_name, args.params);
                 result = JSON.stringify(skillResult.proposal || skillResult.summary || skillResult);
             } else {
                 result = "Error: Skill invocation not available in this context.";
             }
          } else {
            result = `Unknown tool: ${fnName}`;
          }
        } catch (error: any) {
          result = `Error executing ${fnName}: ${error.message}`;
          await ctx.log('error', result);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }
    }

    return {
      summary: "Task stopped after maximum iterations.",
      reply: "I hit the maximum number of steps. Please verify the progress."
    };
  }
};
