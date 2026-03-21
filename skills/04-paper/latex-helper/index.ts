import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

export default class LatexHelperSkill implements Skill {
  id = 'latex_helper';
  name = 'LaTeX Helper';
  description = 'Generate LaTeX templates, tables, and equations.';
  tags = ['research', 'tool', 'latex'];

  parameters = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['template', 'table', 'equation'], description: 'What to generate' },
      data: { type: 'string', description: 'Context or data for generation (e.g. table rows or equation description)' }
    },
    required: ['action']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', `Generating LaTeX: ${params.action}`);
    
    if (params.action === 'template') {
        return {
            status: 'success',
            result: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{${params.data || 'Document Title'}}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Abstract goes here...
\\end{abstract}

\\section{Introduction}
Introduction goes here...

\\bibliographystyle{plain}
\\bibliography{references}
\\end{document}`
        };
    }
    
    // Defer to LLM to write the actual LaTeX syntax based on prompt
    // In a real advanced skill, this might compile the latex using a local texlive installation
    return {
        status: 'success',
        result: `LaTeX helper triggered for ${params.action}. Please write the latex directly in the chat output.`
    };
  }
}
