import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

export default class FigureGeneratorSkill implements Skill {
  id = 'figure_generator';
  name = 'Publication Figure Generator';
  description = 'Create publication-ready figures by orchestrating python plot generator and file saving.';
  tags = ['research', 'paper', 'figure', 'plot'];

  parameters = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The title of the figure' },
      description: { type: 'string', description: 'A detailed description of what the figure should show (e.g. data points, axes labels)' },
      filename: { type: 'string', description: 'The desired output filename (must end in .png or .pdf)' }
    },
    required: ['title', 'description', 'filename']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const { title, description, filename } = params;

    ctx.log('thinking', `Starting figure generation for: "${title}" into ${filename}`);

    if (!ctx.managers?.skill) {
      throw new Error('SkillManager not available in context. Cannot orchestrate built-in skills.');
    }

    ctx.log('action', `Generating Python script for the figure...`);
    
    // Instead of directly calling plot_generator which requires a python script, 
    // the figure_generator uses LLM to write the script, then calls plot_generator.
    const prompt = `Write a python script using matplotlib to generate a plot based on the following requirements:
Title: ${title}
Description: ${description}
Filename: ${filename}

Return ONLY the valid python code block without any markdown formatting.`;

    try {
        const llmResponse = await ctx.llm.complete(prompt);
        let script = llmResponse.content.trim();
        if (script.startsWith('\`\`\`python')) {
            script = script.replace(/^\`\`\`python/, '').replace(/\`\`\`$/, '').trim();
        }

        const plotResult = await ctx.managers.skill.executeSkill('plot_generator', ctx.userId, {
            script: script,
            output_filename: filename
        });
        
        ctx.log('result', `Execution result: ${plotResult?.message || 'Success'}`);
        
        // Verify file exists
        const verifyResult = await ctx.managers.skill.executeSkill('shell', ctx.userId, {
            command: `ls -la ${filename}`
        });
        
        if (verifyResult?.stdout && verifyResult.stdout.includes(filename)) {
            return {
                status: 'success',
                message: `Figure generated successfully and saved as ${filename}`,
                file: filename,
                details: plotResult
            };
        } else {
            throw new Error('Script executed but output file was not found.');
        }

    } catch (e: any) {
        ctx.log('error', `Failed to generate figure: ${e.message}`);
        return {
            status: 'failed',
            message: `Failed to generate figure: ${e.message}`
        };
    }
  }
}