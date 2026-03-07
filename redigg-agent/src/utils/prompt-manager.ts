
import * as fs from 'fs';
import * as path from 'path';

export class PromptManager {
  private prompts: Record<string, string> = {};

  constructor() {
    this.loadPrompts();
  }

  private loadPrompts() {
    const possiblePaths = [
        path.join(__dirname, 'config/prompts.json'),
        path.join(__dirname, '../config/prompts.json'),
        path.join(process.cwd(), 'src/config/prompts.json'),
        path.join(process.cwd(), 'dist/config/prompts.json'),
        // In case it's installed as a global package or in node_modules
        path.join(__dirname, '../../config/prompts.json') 
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf-8');
                this.prompts = JSON.parse(content);
                // console.log(`Loaded prompts from ${p}`);
                return;
            } catch (e) {
                console.error(`Failed to parse prompts from ${p}:`, e);
            }
        }
    }
    console.warn('Warning: prompts.json not found in search paths. Using empty defaults.');
  }

  get(key: string, variables: Record<string, any> = {}): string {
    let template = this.prompts[key] || '';
    
    if (!template) {
        console.warn(`Prompt template not found for key: ${key}`);
        return '';
    }

    // Replace ${var}
    // We use a regex that matches ${varName}
    return template.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (match, varName) => {
        return variables[varName] !== undefined ? String(variables[varName]) : match;
    });
  }
}

export const promptManager = new PromptManager();
