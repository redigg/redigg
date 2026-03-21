import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';
import fs from 'fs/promises';
import path from 'path';
import { resolvePathUnderRoot } from '../../../../workspace/safePath.js';

export default class CodeAnalysisSkill implements Skill {
  id = 'code_analysis';
  name = 'Codebase Analysis';
  description = 'Analyzes project structure and file contents to understand a codebase.';
  tags = ['system', 'code', 'analysis'];

  parameters = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['structure', 'dependencies', 'file'], description: 'The type of analysis to perform.' },
      path: { type: 'string', description: 'Target path to analyze (default: ".").' }
    },
    required: ['operation']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const targetPath = params.path || '.';
    const operation = params.operation || 'scan'; // Default to scan
    const workspaceRoot = ctx.workspace || process.cwd();
    const { absPath: safePath, relPath } = resolvePathUnderRoot(workspaceRoot, targetPath);

    ctx.log('thinking', `Analyzing code at workspace:/${relPath} (operation: ${operation})`);

    try {
      if (operation === 'structure') {
        const structure = await this.getProjectStructure(safePath);
        return { structure };
      } else if (operation === 'summarize') {
        const summary = await this.summarizeCode(ctx, safePath);
        return { summary };
      } else if (operation === 'scan') {
        const scan = await this.scanCodebase(safePath, workspaceRoot);
        return { scan };
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      ctx.log('error', `Code analysis failed: ${error}`);
      throw error;
    }
  }

  private async getProjectStructure(dir: string, depth = 0, maxDepth = 4): Promise<string> {
    if (depth > maxDepth) return ''; 
    
    let output = '';
    try {
      const files = await fs.readdir(dir);
      // Sort: directories first, then files
      const entries = await Promise.all(files.map(async file => {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath).catch(() => null);
          return { file, stat };
      }));
      
      const validEntries = entries.filter(e => e.stat && !e.file.startsWith('.') && e.file !== 'node_modules' && e.file !== 'dist' && e.file !== 'build' && e.file !== '.git');
      
      validEntries.sort((a, b) => {
          if (a.stat!.isDirectory() && !b.stat!.isDirectory()) return -1;
          if (!a.stat!.isDirectory() && b.stat!.isDirectory()) return 1;
          return a.file.localeCompare(b.file);
      });

      for (const { file, stat } of validEntries) {
        const indent = '  '.repeat(depth);
        if (stat!.isDirectory()) {
          output += `${indent}- ${file}/\n`;
          output += await this.getProjectStructure(path.join(dir, file), depth + 1, maxDepth);
        } else {
          output += `${indent}- ${file}\n`;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return output;
  }

  private async scanCodebase(dir: string, workspaceRoot: string): Promise<any> {
      const stats = {
          files: 0,
          directories: 0,
          totalSize: 0,
          extensions: {} as Record<string, number>,
          sloc: 0,
          keyFiles: [] as string[]
      };

      await this.traverse(dir, stats, 0, workspaceRoot);
      
      // Format extensions for display
      const extSummary = Object.entries(stats.extensions)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([ext, count]) => `${ext}: ${count}`)
          .join(', ');

      const summary = `
**Codebase Scan Results**
- **Total Files:** ${stats.files}
- **Directories:** ${stats.directories}
- **Total Size:** ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB
- **Total SLOC:** ${stats.sloc}
- **Key Files:** ${stats.keyFiles.join(', ')}
- **Extensions:** ${extSummary}
      `.trim();

      return { stats, summary };
  }

  private async traverse(dir: string, stats: any, depth = 0, workspaceRoot: string) {
      if (depth > 10) return;
      
      try {
          const files = await fs.readdir(dir);
          for (const file of files) {
              if (file.startsWith('.') || file === 'node_modules' || file === 'dist' || file === 'build' || file === 'coverage') continue;
              
              const filePath = path.join(dir, file);
              const stat = await fs.stat(filePath);
              
              if (stat.isDirectory()) {
                  stats.directories++;
                  await this.traverse(filePath, stats, depth + 1, workspaceRoot);
              } else {
                  stats.files++;
                  stats.totalSize += stat.size;
                  const ext = path.extname(file);
                  if (ext) {
                    stats.extensions[ext] = (stats.extensions[ext] || 0) + 1;
                  }
                  
                  if (['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.html', '.md', '.json', '.py', '.go', '.rs'].includes(ext)) {
                      const content = await fs.readFile(filePath, 'utf-8');
                      stats.sloc += content.split('\n').filter(l => l.trim().length > 0).length;
                  }

                  if (['package.json', 'tsconfig.json', 'README.md', 'Dockerfile', 'docker-compose.yml', 'Makefile', 'Cargo.toml', 'go.mod'].includes(file)) {
                      stats.keyFiles.push(path.relative(workspaceRoot, filePath));
                  }
              }
          }
      } catch (e) {
          // ignore
      }
  }

  private async summarizeCode(ctx: SkillContext, filePath: string): Promise<string> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
          // Summarize directory: list files and maybe read README
          const files = await fs.readdir(filePath);
          const visibleFiles = files.filter(f => !f.startsWith('.'));
          let summary = `Directory: ${path.basename(filePath)}\nFiles: ${visibleFiles.join(', ')}\n`;
          
          if (visibleFiles.includes('README.md')) {
              const readme = await fs.readFile(path.join(filePath, 'README.md'), 'utf-8');
              summary += `\nREADME Preview:\n${readme.slice(0, 200)}...\n`;
          }
          return summary;
      } else {
          // Summarize file
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          const sloc = lines.filter(l => l.trim().length > 0).length;
          
          if (sloc > 500) {
              return `File: ${path.basename(filePath)}\nSLOC: ${sloc}\n(File too large for full summary)`;
          }

          // Use LLM to summarize
          const prompt = `Summarize this code file in 1-2 sentences:\n\n${content}`;
          try {
             const response = await ctx.llm.chat([{ role: 'user', content: prompt }]);
             return `File: ${path.basename(filePath)}\nSLOC: ${sloc}\nSummary: ${response.content}`;
          } catch (e) {
             return `File: ${path.basename(filePath)}\nSLOC: ${sloc}\n(LLM summary failed)`;
          }
      }
    } catch (e) {
      return `Failed to summarize ${filePath}`;
    }
  }
}
