import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';
import fs from 'fs/promises';
import path from 'path';
import { resolvePathUnderRoot } from '../../../../workspace/safePath.js';

export default class LocalFileSkill implements Skill {
  id = 'local_file_ops';
  name = 'Local File Operations';
  description = 'List, read, write, organize, and search local files in the workspace. Use this to read files or write code/documents to the disk.';
  tags = ['system', 'file', 'local'];

  parameters = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['list', 'read', 'write', 'organize', 'search'], description: 'The file operation to perform.' },
      path: { type: 'string', description: 'Target file or directory path relative to workspace.' },
      content: { type: 'string', description: 'Content to write (for "write" operation only).' },
      pattern: { type: 'string', description: 'Search pattern (for "search" operation only).' },
      recursive: { type: 'boolean', description: 'Whether to list/search recursively (default false).' }
    },
    required: ['operation', 'path']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const operation = params.operation as 'list' | 'read' | 'write' | 'organize' | 'search';
    const targetPath = params.path || '.';
    const recursive = params.recursive === true;

    const workspaceRoot = ctx.workspace || process.cwd();
    const { absPath: safePath, relPath } = resolvePathUnderRoot(workspaceRoot, targetPath);

    ctx.log('thinking', `Performing ${operation} on workspace:/${relPath} (recursive: ${recursive})`);

    try {
      switch (operation) {
        case 'list':
          if (recursive) {
            const files = (await this.listRecursive(safePath)).map((f) => `workspace:/${path.relative(workspaceRoot, f)}`);
            ctx.log('tool_result', `Found ${files.length} files recursively`);
            return { files };
          } else {
            const files = (await fs.readdir(safePath)).map((f) => {
              const p = path.join(relPath, f);
              return `workspace:/${p.replaceAll('\\', '/')}`;
            });
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
            return { content, path: `workspace:/${relPath}` };
          } catch (err) {
            ctx.log('error', `Failed to read file: ${err}`);
            throw err;
          }

        case 'write':
          if (!params.content) throw new Error('Content required for write');
          await fs.mkdir(path.dirname(safePath), { recursive: true });
          await fs.writeFile(safePath, params.content, 'utf-8');
          ctx.log('action', `Wrote to file workspace:/${relPath}`);
          return { success: true, path: `workspace:/${relPath}` };

        case 'search':
          const pattern = params.pattern as string;
          if (!pattern) throw new Error('Pattern required for search');
          
          const allFiles = await this.listRecursive(safePath);
          const matchedFiles = allFiles
            .filter(f => f.includes(pattern))
            .map((f) => `workspace:/${path.relative(workspaceRoot, f)}`);
          
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
            return { moved: 0, destination: `workspace:/${relPath}` };
          }

          const papersDir = path.join(safePath, 'papers');
          await fs.mkdir(papersDir, { recursive: true });
          
          for (const pdf of pdfs) {
            await fs.rename(path.join(safePath, pdf), path.join(papersDir, pdf));
          }
          
          ctx.log('tool_result', `Moved ${pdfs.length} PDFs to ${papersDir}`);
          return { moved: pdfs.length, destination: `workspace:/${path.join(relPath, 'papers').replaceAll('\\', '/')}` };

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
