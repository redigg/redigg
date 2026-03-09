import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
export default class PdfGeneratorSkill implements Skill {
    id: string;
    name: string;
    description: string;
    tags: string[];
    private workspaceDir;
    constructor();
    execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult>;
}
