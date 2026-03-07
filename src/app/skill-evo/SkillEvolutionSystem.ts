import { SkillManager } from '../../core/skills/SkillManager.js';
import { LLMClient } from '../../core/llm/LLMClient.js';
import { Skill } from '../../core/skills/types.js';
import fs from 'fs';
import path from 'path';

export class SkillEvolutionSystem {
  private skillManager: SkillManager;
  private llm: LLMClient;
  private skillsDir: string;

  constructor(skillManager: SkillManager, llm: LLMClient, skillsDir: string = path.join(process.cwd(), 'src', 'core', 'skills', 'impl', 'generated')) {
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

    // 1. Check if we need a new skill
    const existingSkills = this.skillManager.getAllSkills();
    const prompt = `
      User Intent: "${intent}"
      Feedback (if any): "${feedback || 'None'}"
      
      Existing Skills:
      ${existingSkills.map(s => `- ${s.id}: ${s.description}`).join('\n')}
      
      Do we need a new skill to handle this intent? 
      If yes, provide a unique skill ID (snake_case) and a description.
      If no, return "NO_NEW_SKILL".
      
      Output format: 
      {
        "id": "skill_id",
        "name": "Skill Name",
        "description": "Skill Description",
        "tags": ["tag1", "tag2"]
      }
    `;

    const analysisResponse = await this.llm.chat([
      { role: 'system', content: 'You are a skill architect. Analyze if a new skill is needed.' },
      { role: 'user', content: prompt }
    ]);

    if (analysisResponse.content.includes('NO_NEW_SKILL')) {
      console.log('[SkillEvolution] No new skill needed.');
      return null;
    }

    let skillMeta;
    try {
      skillMeta = JSON.parse(analysisResponse.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    } catch (e) {
      console.error('[SkillEvolution] Failed to parse skill metadata');
      return null;
    }

    if (!skillMeta.id) return null;

    // 2. Generate Skill Code
    console.log(`[SkillEvolution] Generating code for skill: ${skillMeta.id}`);
    const codePrompt = `
      Generate a TypeScript class for a new Redigg Skill.
      
      Skill Metadata:
      - ID: ${skillMeta.id}
      - Name: ${skillMeta.name}
      - Description: ${skillMeta.description}
      - Tags: ${JSON.stringify(skillMeta.tags)}
      
      User Intent: "${intent}"
      
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
      5. The class should NOT be exported as default, but as a named export.
      6. Do NOT import external libraries other than 'path', 'fs' unless absolutely necessary.
      
      Output ONLY the TypeScript code.
    `;

    const codeResponse = await this.llm.chat([
      { role: 'system', content: 'You are a senior TypeScript developer. Generate high-quality skill code.' },
      { role: 'user', content: codePrompt }
    ]);

    const code = codeResponse.content.replace(/```typescript|```/g, '').trim();
    
    // 3. Save and Load Skill
    const filePath = path.join(this.skillsDir, `${skillMeta.id}.ts`);
    fs.writeFileSync(filePath, code);
    console.log(`[SkillEvolution] Skill saved to ${filePath}`);

    // Dynamic Import (Note: In a real compiled env, this is tricky. For now we assume tsx/ts-node)
    try {
      // For dynamic import to work with TSX, we need to ensure paths are correct
      const fileUrl = `file://${filePath}`;
      const module = await import(fileUrl);
      
      // Find the exported class that implements Skill
      const exports = Object.values(module);
      const SkillClass = exports.find((e: any) => typeof e === 'function' && e.prototype && e.prototype.execute) as any;
      
      if (SkillClass) {
        const skillInstance = new SkillClass();
        this.skillManager.registerSkill(skillInstance);
        console.log(`[SkillEvolution] Skill ${skillMeta.id} registered successfully.`);
        return { skillId: skillMeta.id, code };
      } else {
        console.error(`[SkillEvolution] No valid Skill class found in ${filePath}`);
        return null;
      }
    } catch (error) {
      console.error(`[SkillEvolution] Failed to load generated skill: ${error}`);
      return null;
    }
  }
}
