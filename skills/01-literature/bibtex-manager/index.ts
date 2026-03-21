import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

export default class BibtexManagerSkill implements Skill {
  id = 'bibtex_manager';
  name = 'BibTeX Manager';
  description = 'Parse, generate, and manage BibTeX references.';
  tags = ['research', 'tool', 'citation', 'bibtex'];

  parameters = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['generate'], description: 'Action to perform (currently supports generate)' },
      metadata: { 
        type: 'object', 
        description: 'Metadata of the paper (title, authors array, year, journal, url)' 
      }
    },
    required: ['action', 'metadata']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', `Managing BibTeX: ${params.action}`);
    
    try {
      if (params.action === 'generate') {
        const { metadata } = params;
        if (!metadata || !metadata.title) {
          return { status: 'failed', message: 'Metadata with at least a title is required.' };
        }
        
        const authors = Array.isArray(metadata.authors) ? metadata.authors.join(' and ') : (metadata.authors || 'Unknown');
        const firstAuthorLast = authors.split(',')[0].split(' ').pop() || 'Unknown';
        const year = metadata.year || new Date().getFullYear();
        const citeKey = `${firstAuthorLast}${year}${metadata.title.split(' ')[0]}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        const bibtex = `@article{${citeKey},
  title={${metadata.title}},
  author={${authors}},
  year={${year}},
  journal={${metadata.journal || 'arXiv pre-print'}},
  url={${metadata.url || ''}}
}`;
        return { status: 'success', data: bibtex };
      }
      
      return { status: 'failed', message: `Action ${params.action} not implemented yet.` };
    } catch (error: any) {
      return { status: 'failed', message: error.message };
    }
  }
}
