import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';

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
    
    // Create a document
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Title Page
    doc.fontSize(24).text(title || 'Research Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Author: ${author}`, { align: 'center' });
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Content Rendering (Simple Markdown Parser)
    const lines = content.split('\n');
    let inList = false;

    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('# ')) {
            doc.addPage(); // New page for main chapters? Maybe just space
            doc.fontSize(20).text(trimmed.substring(2), { underline: true });
            doc.moveDown(0.5);
        } else if (trimmed.startsWith('## ')) {
            doc.fontSize(16).text(trimmed.substring(3));
            doc.moveDown(0.5);
        } else if (trimmed.startsWith('### ')) {
            doc.fontSize(14).text(trimmed.substring(4));
            doc.moveDown(0.5);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            doc.fontSize(12).text(`• ${trimmed.substring(2)}`, { indent: 20 });
        } else if (trimmed.match(/^\d+\./)) {
             doc.fontSize(12).text(trimmed, { indent: 20 });
        } else if (trimmed === '') {
            doc.moveDown(0.5);
        } else {
            // Normal paragraph
            // Handle bold **text** (simple regex replace won't work easily with pdfkit text flow without mixed fonts)
            // For now, just render plain text
            doc.fontSize(12).text(line, { align: 'justify' });
        }
    }

    // Finalize PDF file
    doc.end();

    if (ctx.updateProgress) await ctx.updateProgress(100, `PDF Generated.`);

    // Return relative path for frontend to access (assuming static serve)
    // We need to make sure the workspace/output is served by express.
    const relativeUrl = `/files/pdfs/${filename}.pdf`;

    return {
      success: true,
      file_path: pdfPath,
      url: relativeUrl,
      formatted_output: `### PDF Generated\n\n[Download PDF](${relativeUrl})`
    };
  }
}
