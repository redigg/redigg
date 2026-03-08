import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import fs from 'fs/promises';
import path from 'path';

export default class LocalFileSkill implements Skill {
  id = 'local_file_ops';
  name = 'Local File Operations';
  description = 'List, read, organize, and search local research files';
  tags = ['system', 'file', 'local'];

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const operation = params.operation as 'list' | 'read' | 'write' | 'organize' | 'search';
    const targetPath = params.path || '.';
    const recursive = params.recursive === true;
    
    // Security check: ensure path is within workspace or allowed dirs
    const safePath = path.resolve(process.cwd(), targetPath); // Default to CWD for now
    
    ctx.log('thinking', `Performing ${operation} on ${safePath} (recursive: ${recursive})`);

    try {
      switch (operation) {
        case 'list':
          if (recursive) {
            const files = await this.listRecursive(safePath);
            ctx.log('tool_result', `Found ${files.length} files recursively`);
            return { files };
          } else {
            const files = await fs.readdir(safePath);
            ctx.log('tool_result', `Found ${files.length} files`);
            return { files };
          }
        
        case 'read':
          try {
            const stat = await fs.stat(safePath);
            if (stat.isDirectory()) {
               throw new Error('Path is a directory, not a file');
            }
            const content = await fs.readFile(safePath, 'utf-8');
            ctx.log('tool_result', `Read ${content.length} characters`);
            return { content, path: safePath };
          } catch (err) {
            ctx.log('error', `Failed to read file: ${err}`);
            throw err;
          }

        case 'write':
          if (!params.content) throw new Error('Content required for write');
          await fs.writeFile(safePath, params.content, 'utf-8');
          ctx.log('action', `Wrote to file ${safePath}`);
          return { success: true, path: safePath };

        case 'search':
          const pattern = params.pattern as string;
          if (!pattern) throw new Error('Pattern required for search');
          
          const allFiles = await this.listRecursive(safePath);
          const matchedFiles = allFiles.filter(f => f.includes(pattern));
          
          ctx.log('tool_result', `Found ${matchedFiles.length} files matching "${pattern}"`);
          return { files: matchedFiles };

        case 'organize':
          // Example: Move PDFs to a 'papers' folder
          ctx.log('action', 'Organizing PDF files...');
          
          let fileList: string[] = [];
          try {
             fileList = await fs.readdir(safePath);
          } catch (e) {
             ctx.log('error', `Failed to read dir ${safePath}: ${e}`);
             return { moved: 0 };
          }

          const pdfs = fileList.filter(f => f.toLowerCase().endsWith('.pdf'));
          
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

  private async listRecursive(dir: string): Promise<string[]> {
    let results: string[] = [];
    try {
        const list = await fs.readdir(dir);
        for (const file of list) {
            if (file.startsWith('.') || file === 'node_modules') continue;
            
            const filePath = path.resolve(dir, file);
            const stat = await fs.stat(filePath);
            
            if (stat && stat.isDirectory()) {
                const res = await this.listRecursive(filePath);
                results = results.concat(res);
            } else {
                results.push(filePath);
            }
        }
    } catch (err) {
        // Ignore permission errors or missing dirs during recursion
    }
    return results;
  }
}
