import { SkillManager } from '../SkillManager.js';
import { LLMClient } from '../../llm/LLMClient.js';
import { Skill } from '../types.js';
import fs from 'fs';
import path from 'path';

export class SkillEvolutionSystem {
  private skillManager: SkillManager;
  private llm: LLMClient;
  private skillsDir: string;

  constructor(skillManager: SkillManager, llm: LLMClient, skillsDir: string = path.join(process.cwd(), 'skills')) {
    this.skillManager = skillManager;
    this.llm = llm;
    this.skillsDir = skillsDir;
    
    // Ensure directory exists
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
  }

  public async evolveSkill(
    intent: string, 
    feedback?: string
  ): Promise<{ skillId: string, code: string } | null> {
    console.log(`[SkillEvolution] Analyzing intent: "${intent}"`);

    // 1. Check if we need a new skill OR update an existing one
    const existingSkills = this.skillManager.getAllSkills();
    const prompt = `
      User Intent: "${intent}"
      Feedback (if any): "${feedback || 'None'}"
      
      Existing Skills:
      ${existingSkills.map(s => `- ${s.id}: ${s.description}`).join('\n')}
      
      Analyze the request:
      1. Do we need a NEW skill? (Return "NEW_SKILL")
      2. Should we UPDATE an existing skill? (Return "UPDATE_SKILL")
      3. Is no action needed? (Return "NO_ACTION")
      
      Output format: 
      {
        "action": "NEW_SKILL" | "UPDATE_SKILL" | "NO_ACTION",
        "id": "skill-id",
        "name": "Skill Name",
        "description": "Skill Description",
        "tags": ["tag1", "tag2"],
        "reasoning": "Why this action is needed"
      }
    `;

    const analysisResponse = await this.llm.chat([
      { role: 'system', content: 'You are a skill architect. Analyze if a new skill is needed or an existing one should be improved.' },
      { role: 'user', content: prompt }
    ]);

    let skillMeta;
    try {
      skillMeta = JSON.parse(analysisResponse.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    } catch (e) {
      console.error('[SkillEvolution] Failed to parse skill metadata');
      return null;
    }

    if (skillMeta.action === 'NO_ACTION') {
      console.log('[SkillEvolution] No action needed.');
      return null;
    }

    if (!skillMeta.id) return null;

    // 2. Generate Skill Code
    console.log(`[SkillEvolution] Generating code for skill: ${skillMeta.id} (${skillMeta.action})`);
    
    // If updating, load existing code
    let existingCode = '';
    if (skillMeta.action === 'UPDATE_SKILL') {
        const existingSkillPath = path.join(this.skillsDir, skillMeta.id, 'index.ts');
        if (fs.existsSync(existingSkillPath)) {
            existingCode = fs.readFileSync(existingSkillPath, 'utf-8');
        }
    }

    const codePrompt = `
      Generate a TypeScript class for a Redigg Skill.
      Action: ${skillMeta.action}
      
      Skill Metadata:
      - ID: ${skillMeta.id}
      - Name: ${skillMeta.name}
      - Description: ${skillMeta.description}
      - Tags: ${JSON.stringify(skillMeta.tags)}
      
      User Intent: "${intent}"
      Feedback: "${feedback || ''}"
      
      ${existingCode ? `Existing Code:\n\`\`\`typescript\n${existingCode}\n\`\`\`` : ''}
      
      Context Interfaces:
      export interface SkillContext {
        llm: LLMClient;
        memory: MemoryManager;
        workspace: string;
        userId: string;
        log: (type: 'thinking'|'action'|'tool_call'|'tool_result'|'result'|'error', content: string, metadata?: any) => void;
      }
      
      Requirements:
      1. Implement 'Skill' interface.
      2. Use 'ctx.llm.complete(prompt)' for reasoning.
      3. Use 'ctx.log()' for logging steps.
      4. Return a structured 'SkillResult'.
      5. The class MUST be exported as default: 'export default class ...'
      6. Do NOT import external libraries other than 'path', 'fs' unless absolutely necessary.
      7. If updating, preserve existing functionality unless explicitly asked to change. Improve the logic based on intent.
      
      Output ONLY the TypeScript code.
    `;

    const codeResponse = await this.llm.chat([
      { role: 'system', content: 'You are a senior TypeScript developer. Generate high-quality skill code.' },
      { role: 'user', content: codePrompt }
    ]);

    const code = codeResponse.content.replace(/```typescript|```/g, '').trim();
    
    // 3. Save and Load Skill
    // Create skill directory
    const skillPath = path.join(this.skillsDir, skillMeta.id);
    if (!fs.existsSync(skillPath)) {
        fs.mkdirSync(skillPath, { recursive: true });
    }

    // Save index.ts
    const indexFilePath = path.join(skillPath, 'index.ts');
    fs.writeFileSync(indexFilePath, code);
    
    // Save SKILL.md (minimal)
    const skillMdContent = `---
name: ${skillMeta.id}
description: ${skillMeta.description}
tags: ${JSON.stringify(skillMeta.tags)}
---

# ${skillMeta.name}

${skillMeta.description}

## Generated
This skill was automatically generated by the Skill Evolution System.
`;
    fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillMdContent);

    console.log(`[SkillEvolution] Skill saved to ${skillPath}`);

    // Dynamic Import
    try {
      const fileUrl = `file://${indexFilePath}`;
      const module = await import(fileUrl);
      
      // Expect default export
      if (module.default) {
        const skillInstance = new module.default();
        if (skillInstance.id && skillInstance.execute) {
            this.skillManager.registerSkill(skillInstance);
            console.log(`[SkillEvolution] Skill ${skillMeta.id} registered successfully.`);
            return { skillId: skillMeta.id, code };
        }
      }
      
      console.error(`[SkillEvolution] No valid default export found in ${indexFilePath}`);
      return null;
    } catch (error) {
      console.error(`[SkillEvolution] Failed to load generated skill: ${error}`);
      return null;
    }
  }
}
