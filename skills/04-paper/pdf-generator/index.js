import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
const execAsync = promisify(exec);
export default class PdfGeneratorSkill {
    id = 'pdf_generator';
    name = 'PDF Generator (LaTeX)';
    description = 'Generate a PDF from text/markdown using LaTeX';
    tags = ['research', 'document', 'pdf', 'latex'];
    workspaceDir;
    constructor() {
        // Ensure output directory exists
        this.workspaceDir = path.resolve(process.cwd(), 'workspace/output/pdfs');
    }
    async execute(ctx, params) {
        const { title, content, author = 'Redigg AI' } = params;
        if (!content) {
            throw new Error('Content is required to generate PDF');
        }
        // Ensure output directory exists
        await fs.mkdir(this.workspaceDir, { recursive: true });
        ctx.log('thinking', `Generating PDF for "${title || 'Untitled'}"`);
        if (ctx.updateProgress)
            await ctx.updateProgress(10, `Preparing LaTeX template...`);
        // 1. Convert content to LaTeX
        // For now, we'll do a simple conversion or ask LLM to convert if it's complex markdown.
        // Let's ask LLM to convert the markdown/text to LaTeX body content.
        const prompt = `
      Convert the following Markdown/Text content into LaTeX code suitable for the document body.
      Do not include \\documentclass, \\begin{document}, or preamble. Just the body content.
      Use standard LaTeX commands for sections, lists, bold, italics, etc.
      Escape special characters like %, $, _, etc. properly unless they are math.
      
      Content:
      ${content}
    `;
        const llmRes = await ctx.llm.complete(prompt);
        const latexBody = llmRes.content;
        if (ctx.updateProgress)
            await ctx.updateProgress(40, `Compiling LaTeX...`);
        // 2. Create full LaTeX document
        const filename = (title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + uuidv4().slice(0, 8);
        const texPath = path.join(this.workspaceDir, `${filename}.tex`);
        const pdfPath = path.join(this.workspaceDir, `${filename}.pdf`);
        const latexDoc = `
\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{parskip}

\\geometry{
 a4paper,
 total={170mm,257mm},
 left=20mm,
 top=20mm,
}

\\title{${title || 'Research Report'}}
\\author{${author}}
\\date{\\today}

\\begin{document}

\\maketitle

${latexBody}

\\end{document}
    `;
        await fs.writeFile(texPath, latexDoc);
        // 3. Compile PDF using pdflatex
        try {
            ctx.log('action', `Running pdflatex on ${texPath}`);
            // Check for pdflatex first
            try {
                await execAsync('pdflatex --version');
            }
            catch (e) {
                throw new Error('pdflatex is not installed. Please install it:\nMacOS: brew install --cask basictex\nLinux: apt-get install texlive-latex-base');
            }
            // Run twice for references/toc if needed, but once is usually fine for simple docs
            await execAsync(`pdflatex -interaction=nonstopmode -output-directory=${this.workspaceDir} ${texPath}`);
        }
        catch (error) {
            if (error.message.includes('pdflatex is not installed')) {
                throw error;
            }
            // If compilation failed, maybe read the log file?
            const logPath = texPath.replace('.tex', '.log');
            let logContent = '';
            try {
                logContent = await fs.readFile(logPath, 'utf-8');
            }
            catch (e) { }
            throw new Error(`LaTeX compilation failed: ${error.message}\n\nLog tail:\n${logContent.slice(-500)}`);
        }
        if (ctx.updateProgress)
            await ctx.updateProgress(100, `PDF Generated.`);
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
//# sourceMappingURL=index.js.map