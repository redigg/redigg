import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';

export default class GetCurrentTimeSkill implements Skill {
  id = 'get_current_time';
  name = 'Get Current Time';
  description = 'Get the current system date and time.';
  tags = ['system', 'tool', 'time'];

  parameters = {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['iso', 'utc', 'local'], description: 'Time format to return (default: iso)' }
    },
    required: []
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', 'Getting current system time.');
    const now = new Date();
    let result = now.toISOString();
    
    if (params.format === 'utc') result = now.toUTCString();
    else if (params.format === 'local') result = now.toLocaleString();
    
    return { result };
  }
}
