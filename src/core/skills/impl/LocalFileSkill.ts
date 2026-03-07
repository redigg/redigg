import { Skill, SkillContext, SkillParams, SkillResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

export class LocalFileSkill implements Skill {
  id = 'local_file_ops';
  name = 'Local File Operations';
  description = 'List, read, and organize local research files';
  tags = ['system', 'file', 'local'];

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const operation = params.operation as 'list' | 'read' | 'write' | 'organize';
    const targetPath = params.path || '.';
    
    // Security check: ensure path is within workspace or allowed dirs
    // For MVP/Demo, we assume the agent runs in a trusted local environment, 
    // but strictly we should limit this.
    const safePath = path.resolve(ctx.workspace, targetPath);
    
    ctx.log('thinking', `Performing ${operation} on ${safePath}`);

    try {
      switch (operation) {
        case 'list':
          const files = await fs.readdir(safePath);
          ctx.log('tool_result', `Found ${files.length} files`);
          return { files };
        
        case 'read':
          const content = await fs.readFile(safePath, 'utf-8');
          ctx.log('tool_result', `Read ${content.length} bytes`);
          return { content };

        case 'write':
          if (!params.content) throw new Error('Content required for write');
          await fs.writeFile(safePath, params.content);
          ctx.log('action', `Wrote to file ${safePath}`);
          return { success: true };

        case 'organize':
          // Example: Move PDFs to a 'papers' folder
          ctx.log('action', 'Organizing PDF files...');
          
          let allFiles: string[] = [];
          try {
             allFiles = await fs.readdir(safePath);
          } catch (e) {
             ctx.log('error', `Failed to read dir ${safePath}: ${e}`);
             return { moved: 0 };
          }

          const pdfs = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
          
          if (pdfs.length === 0) {
            return { moved: 0, destination: safePath };
          }

          const papersDir = path.join(safePath, 'papers');
          await fs.mkdir(papersDir, { recursive: true });
          
          for (const pdf of pdfs) {
            await fs.rename(path.join(safePath, pdf), path.join(papersDir, pdf));
          }
          
          ctx.log('tool_result', `Moved ${pdfs.length} PDFs to ${papersDir}`);
          return { moved: pdfs.length, destination: papersDir };

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      ctx.log('error', `File operation failed: ${error}`);
      throw error;
    }
  }
}
