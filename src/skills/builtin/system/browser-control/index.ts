import { Skill, SkillContext, SkillParams, SkillResult } from '../../../types.js';
import * as cheerio from 'cheerio';

export default class BrowserControlSkill implements Skill {
  id = 'browser_control';
  name = 'Web Browser / Fetcher';
  description = 'Fetch web pages and extract clean text content.';
  tags = ['system', 'tool', 'browser', 'web'];

  parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
      action: { type: 'string', enum: ['fetch_text'], description: 'Action to perform (default: fetch_text)' }
    },
    required: ['url']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', `Browsing web page: ${params.url}`);
    
    try {
      // Very basic fetch
      const response = await fetch(params.url, {
          headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RediggResearchBot/1.0; +http://redigg.com)'
          }
      });
      
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      
      // Parse with Cheerio to extract readable text
      const $ = cheerio.load(html);
      
      // Remove scripts, styles, and non-content elements
      $('script, style, noscript, iframe, svg, nav, footer, header').remove();
      
      let text = $('body').text().replace(/\s+/g, ' ').trim();
      
      // Truncate to avoid context limit overflow
      const MAX_CHARS = 20000;
      if (text.length > MAX_CHARS) {
          text = text.substring(0, MAX_CHARS) + '\n\n...[Content truncated due to length]...';
      }
      
      return { 
        result: `Successfully fetched content from ${params.url}`,
        content: text,
        title: $('title').text().trim() || params.url
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch URL: ${error.message}`
      };
    }
  }
}
