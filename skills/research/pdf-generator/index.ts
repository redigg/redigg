import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { parseAcademicMarkdown, renderAcademicPdf } from './renderer.js';

export default class PdfGeneratorSkill implements Skill {
  id = 'pdf_generator';
  name = 'PDF Generator';
  description = 'Generate a PDF from text/markdown using PDFKit';
  tags = ['research', 'document', 'pdf'];

  private workspaceDir: string;

  constructor() {
    // Ensure output directory exists
    this.workspaceDir = path.resolve(process.cwd(), 'workspace/output/pdfs');
  }

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const { title, content, author = 'Redigg AI' } = params;
    
    if (!content) {
      throw new Error('Content is required to generate PDF');
    }

    // Ensure output directory exists
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }

    ctx.log('thinking', `Generating PDF for "${title || 'Untitled'}"`);
    if (ctx.updateProgress) await ctx.updateProgress(10, `Initializing PDF document...`);

    const filename = (title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + uuidv4().slice(0, 8);
    const pdfPath = path.join(this.workspaceDir, `${filename}.pdf`);
    
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
    const relativeUrl = `/files/pdfs/${filename}.pdf`;

    return {
      success: true,
      file_path: pdfPath,
      url: relativeUrl,
      title: resolvedTitle,
      formatted_output: `### PDF Generated\n\n[Download PDF](${relativeUrl})`
    };
  }
}
