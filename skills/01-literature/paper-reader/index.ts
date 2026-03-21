import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import fs from 'fs/promises';
import path from 'path';
import * as pdfParseModule from 'pdf-parse';
import { resolvePathUnderRoot } from '../../../src/workspace/safePath.js';

// Handle esm/cjs default export interop
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

export default class PaperReaderSkill implements Skill {
  id = 'paper_reader';
  name = 'Paper Reader';
  description = 'Extract text from PDF papers.';
  tags = ['research', 'tool', 'pdf', 'extract'];

  parameters = {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to the PDF file (absolute or relative to workspace)' }
    },
    required: ['file_path']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', `Reading paper from: ${params.file_path}`);
    
    try {
      const workspaceRoot = ctx.workspace || process.cwd();
      const { absPath: targetPath } = resolvePathUnderRoot(workspaceRoot, String(params.file_path || ''));
      const dataBuffer = await fs.readFile(targetPath);
      
      const data = await pdfParse(dataBuffer);
      
      // Limit text length to prevent blowing up the LLM context (e.g. max 50k chars)
      const MAX_CHARS = 50000;
      const text = data.text.length > MAX_CHARS 
        ? data.text.substring(0, MAX_CHARS) + '\n\n...[Text truncated due to length]...'
        : data.text;
        
      return { 
        result: `Extracted ${data.numpages} pages.\n\n${text}`,
        metadata: {
          pages: data.numpages,
          info: data.info
        }
      };
    } catch (error: any) {
      return {
        status: 'failed',
        error: `Failed to read PDF: ${error.message}`
      };
    }
  }
}
