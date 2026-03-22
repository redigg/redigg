import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

interface Paper {
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  url: string;
}

interface PaperIdea {
  title: string;
  title_zh: string;
  research_gap: string;
  research_questions: string[];
  core_method: string;
  score: number;
  difficulty: string;
  novelty: string;
  feasibility: string;
  timeline: string;
  related_papers: string[];
}

// Research gap keywords by category
const TECH_KEYWORDS: Record<string, string[]> = {
  agent: ['hierarchical', 'peer-to-peer', 'competitive', 'collaborative', 'hybrid', 'blackboard', 'event-driven'],
  memory: ['shared', 'hierarchical', 'episodic', 'semantic', 'working', 'long-term'],
  reasoning: ['chain-of-thought', 'tree-of-thought', 'multi-hop', 'speculative', 'self-consistency'],
  learning: ['reinforcement', 'supervised', 'unsupervised', 'meta-learning', 'continual', 'transfer'],
  optimization: ['quantization', 'pruning', 'distillation', 'speculative-decoding', 'cache'],
  retrieval: ['sparse', 'dense', 'hybrid', 'multi-modal', 'adaptive', 'cache-enhanced']
};

export default class PaperIdeaGeneratorSkill implements Skill {
  id = 'paper_idea_generator';
  name = 'Paper Idea Generator';
  description = 'Generates novel, actionable paper ideas by fetching arXiv papers and using LLM analysis.';
  tags = ['research', 'idea', 'paper', 'arxiv', 'generation'];

  parameters = {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'The research topic or domain.' },
      num_ideas: { type: 'number', description: 'Number of ideas to generate (default 5).' },
      max_papers: { type: 'number', description: 'Maximum papers to fetch from arXiv (default 20).' }
    },
    required: ['topic']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const topic = params.topic;
    const numIdeas = params.num_ideas || 5;
    const maxPapers = params.max_papers || 20;

    ctx.log('thinking', `Generating ${numIdeas} paper ideas for topic: ${topic}`);

    try {
      // Step 1: Fetch papers from arXiv
      ctx.log('info', `Fetching papers from arXiv...`);
      const papers = await this.fetchFromArxiv(topic, maxPapers);
      ctx.log('info', `Found ${papers.length} papers`);

      // Step 2: Identify research gaps
      ctx.log('info', `Identifying research gaps...`);
      const gaps = this.identifyGaps(papers, topic);
      ctx.log('info', `Found ${gaps.length} potential gaps`);

      // Step 3: Generate ideas using LLM
      ctx.log('info', `Generating paper ideas...`);
      const ideas: PaperIdea[] = [];
      
      for (const gap of gaps.slice(0, numIdeas)) {
        const idea = await this.generateIdea(ctx, gap, topic, papers);
        ideas.push(idea);
        ctx.log('info', `Generated: ${idea.title}`);
      }

      // Step 4: Format output
      const markdown = this.formatReport(ideas, topic, papers.length);

      return {
        success: true,
        ideas,
        papers_found: papers.length,
        markdown
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate ideas: ${error.message}`
      };
    }
  }

  private async fetchFromArxiv(topic: string, maxPapers: number): Promise<Paper[]> {
    const query = `all:${encodeURIComponent(topic)}`;
    const url = `http://export.arxiv.org/api/query?search_query=${query}&max_results=${maxPapers}&sortBy=relevance`;
    
    const response = await fetch(url);
    const xmlText = await response.text();
    
    // Parse arXiv XML response
    const papers: Paper[] = [];
    const entries = xmlText.split('<entry>');
    
    for (const entry of entries.slice(1)) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
      const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
      
      if (titleMatch && summaryMatch) {
        papers.push({
          title: titleMatch[1].trim().replace(/\n/g, ' '),
          authors: this.extractAuthors(entry),
          year: publishedMatch ? parseInt(publishedMatch[1].substring(0, 4)) : 0,
          abstract: summaryMatch[1].trim().replace(/\n/g, ' '),
          url: idMatch ? idMatch[1].trim() : ''
        });
      }
    }
    
    return papers;
  }

  private extractAuthors(entry: string): string[] {
    const authors: string[] = [];
    const authorMatches = entry.matchAll(/<name>([\s\S]*?)<\/name>/g);
    for (const match of authorMatches) {
      authors.push(match[1].trim());
    }
    return authors;
  }

  private identifyGaps(papers: Paper[], topic: string): { name: string; category: string }[] {
    const existingTechs = new Set<string>();
    const allText = papers.map(p => `${p.title} ${p.abstract}`).join(' ').toLowerCase();
    
    for (const [category, keywords] of Object.entries(TECH_KEYWORDS)) {
      for (const kw of keywords) {
        if (allText.includes(kw)) {
          existingTechs.add(`${category}:${kw}`);
        }
      }
    }
    
    const gaps: { name: string; category: string }[] = [];
    for (const [category, keywords] of Object.entries(TECH_KEYWORDS)) {
      for (const kw of keywords) {
        const key = `${category}:${kw}`;
        if (!existingTechs.has(key)) {
          gaps.push({ name: kw, category });
        }
      }
    }
    
    return gaps;
  }

  private async generateIdea(
    ctx: SkillContext,
    gap: { name: string; category: string },
    topic: string,
    papers: Paper[]
  ): Promise<PaperIdea> {
    const relatedPapers = papers.slice(0, 3).map(p => p.title);
    
    const prompt = `Based on the research gap "${gap.name}" in the category "${gap.category}", generate a novel paper idea for the topic "${topic}".

Output in JSON format:
{
  "title": "English title",
  "title_zh": "Chinese title",  
  "questions": ["Research question 1", "Research question 2"],
  "method": "Core methodology description",
  "score": 85,
  "difficulty": "medium",
  "novelty": "moderate",
  "feasibility": "high",
  "timeline": "3-6 months"
}

Output only valid JSON.`;

    const response = await ctx.llm.complete(prompt);
    
    let data: any = {};
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      }
    } catch {
      data = {};
    }
    
    const gapTitle = gap.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    return {
      title: data.title || `${gapTitle} for ${topic}`,
      title_zh: data.title_zh || `${topic}中的${gap.name}机制研究`,
      research_gap: gap.name,
      research_questions: data.questions || [`How to design efficient ${gap.name} mechanism?`],
      core_method: data.method || '',
      score: data.score || 80,
      difficulty: data.difficulty || 'medium',
      novelty: data.novelty || 'moderate',
      feasibility: data.feasibility || 'high',
      timeline: data.timeline || '3-6 months',
      related_papers: relatedPapers
    };
  }

  private formatReport(ideas: PaperIdea[], topic: string, paperCount: number): string {
    const lines: string[] = [
      `# 📝 论文点子生成报告`,
      ``,
      `**研究主题**: ${topic}`,
      `**论文数量**: ${paperCount}`,
      `**点子数量**: ${ideas.length}`,
      ``,
      `---`,
      ``
    ];
    
    for (let i = 0; i < ideas.length; i++) {
      const idea = ideas[i];
      lines.push(`## 💡 点子 ${i + 1}: ${idea.title}`);
      lines.push(``);
      lines.push(`**中文标题**: ${idea.title_zh}`);
      lines.push(``);
      lines.push(`**研究空白**: ${idea.research_gap}`);
      lines.push(``);
      lines.push(`### 研究问题`);
      for (const q of idea.research_questions) {
        lines.push(`- ${q}`);
      }
      lines.push(``);
      lines.push(`### 核心方法`);
      lines.push(idea.core_method);
      lines.push(``);
      lines.push(`### 评估`);
      lines.push(`| 维度 | 评估 |`);
      lines.push(`|------|------|`);
      lines.push(`| 难度 | ${idea.difficulty} |`);
      lines.push(`| 新颖性 | ${idea.novelty} |`);
      lines.push(`| 可行性 | ${idea.feasibility} |`);
      lines.push(`| 时间线 | ${idea.timeline} |`);
      lines.push(`| **评分** | **${idea.score}** |`);
      lines.push(``);
      lines.push(`### 参考论文`);
      for (const p of idea.related_papers) {
        lines.push(`- ${p}`);
      }
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    }
    
    return lines.join('\n');
  }
}