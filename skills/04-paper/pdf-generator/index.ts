import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { parseAcademicMarkdown, renderAcademicPdf } from './renderer.js';

export default class PdfGeneratorSkill implements Skill {
  id = 'pdf_generator';
  name = 'PDF Document Generator';
  description = 'Converts markdown text to a beautifully formatted PDF document. Always use this tool when user asks to generate, save, or export a PDF.';
  tags = ['export', 'pdf', 'document'];

  parameters = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the PDF document.' },
      content: { type: 'string', description: 'Markdown content to be converted into the PDF.' },
      filename: { type: 'string', description: 'Optional custom filename (without .pdf).' }
    },
    required: ['title', 'content']
  };

  private defaultWorkspaceDir = path.resolve(process.cwd(), 'workspace/output/pdfs');

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const { title, content, author = 'Redigg AI', sessionId } = params;
    
    if (!content) {
      throw new Error('Content is required to generate PDF');
    }

    const outputDir = typeof sessionId === 'string' && sessionId.trim()
      ? path.resolve(process.cwd(), 'workspace', 'sessions', sessionId.trim(), 'output', 'pdfs')
      : this.defaultWorkspaceDir;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ctx.log('thinking', `Generating PDF for "${title || 'Untitled'}"`);
    if (ctx.updateProgress) await ctx.updateProgress(10, `Initializing PDF document...`);

    const filename = (title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + uuidv4().slice(0, 8);
    const pdfPath = path.join(outputDir, `${filename}.pdf`);
    
    const parsedDocument = parseAcademicMarkdown(title, String(content));
    const resolvedTitle = parsedDocument.title || title || 'Research Report';

    // Create a document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      bufferPages: true
    });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    renderAcademicPdf(doc, parsedDocument, {
      title: resolvedTitle,
      author: String(author),
      generatedAt: new Date()
    });

    // Finalize PDF file
    const finished = new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
      doc.on('error', reject);
    });
    doc.end();
    await finished;

    if (ctx.updateProgress) await ctx.updateProgress(100, `PDF Generated.`);

    // Return relative path for frontend to access (assuming static serve)
    // We need to make sure the workspace/output is served by express.
    const relativeUrl = typeof sessionId === 'string' && sessionId.trim()
      ? `/files/sessions/${sessionId.trim()}/output/pdfs/${filename}.pdf`
      : `/files/pdfs/${filename}.pdf`;

    return {
      success: true,
      file_path: pdfPath,
      url: relativeUrl,
      title: resolvedTitle,
      formatted_output: `### PDF Generated\n\n[Download PDF](${relativeUrl})`
    };
  }
}
