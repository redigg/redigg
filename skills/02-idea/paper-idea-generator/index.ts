import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';

interface Paper {
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  url: string;
  categories?: string[];
}

interface PaperIdea {
  id: string;
  title: string;
  title_zh: string;
  research_gap: string;
  research_gap_category: string;
  research_questions: string[];
  core_method: string;
  experiments: Experiment[];
  expected_contributions: string[];
  related_papers: string[];
  score: number;
  difficulty: 'easy' | 'medium' | 'hard';
  novelty: 'incremental' | 'moderate' | 'breakthrough';
  feasibility: 'high' | 'medium' | 'low';
  timeline: string;
  resources_needed: string[];
}

interface Experiment {
  name: string;
  dataset: string;
  baselines: string[];
  metrics: string[];
}

// Extended research gap keywords by category
const TECH_KEYWORDS: Record<string, string[]> = {
  agent: [
    'hierarchical', 'peer-to-peer', 'competitive', 'collaborative', 'hybrid',
    'blackboard', 'event-driven', 'centralized', 'decentralized', 'federated',
    'multi-agent', 'single-agent', 'ensemble', 'voting', 'consensus'
  ],
  memory: [
    'shared', 'hierarchical', 'episodic', 'semantic', 'working', 'long-term',
    'short-term', 'external', 'internal', 'distributed', 'compressed', 'cached'
  ],
  reasoning: [
    'chain-of-thought', 'tree-of-thought', 'multi-hop', 'speculative', 
    'self-consistency', 'analogical', 'causal', 'counterfactual', 'abductive'
  ],
  learning: [
    'reinforcement', 'supervised', 'unsupervised', 'meta-learning', 
    'continual', 'transfer', 'few-shot', 'zero-shot', 'active', 'curriculum'
  ],
  optimization: [
    'quantization', 'pruning', 'distillation', 'speculative-decoding', 
    'cache', 'parallelization', 'caching', 'batching', 'streaming'
  ],
  retrieval: [
    'sparse', 'dense', 'hybrid', 'multi-modal', 'adaptive', 'cache-enhanced',
    're-ranking', 'query-expansion', 'chunking', 'embedding', 'indexing'
  ]
};

export default class PaperIdeaGeneratorSkill implements Skill {
  id = 'paper_idea_generator';
  name = 'Paper Idea Generator';
  description = 'Generates novel, actionable paper ideas by fetching arXiv papers and using LLM analysis. Supports multiple languages and detail levels.';
  tags = ['research', 'idea', 'paper', 'arxiv', 'generation', 'brainstorming'];

  parameters = {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'The research topic or domain.' },
      num_ideas: { type: 'number', description: 'Number of ideas (default 5, max 10).' },
      max_papers: { type: 'number', description: 'Max papers from arXiv (default 20).' },
      language: { type: 'string', enum: ['en', 'zh', 'both'], description: 'Output language.' },
      detail_level: { type: 'string', enum: ['brief', 'standard', 'detailed'], description: 'Detail level.' },
      focus_areas: { type: 'array', items: { type: 'string' }, description: 'Focus areas.' }
    },
    required: ['topic']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    const topic = params.topic;
    const numIdeas = Math.min(params.num_ideas || 5, 10);
    const maxPapers = params.max_papers || 20;
    const language = params.language || 'both';
    const detailLevel = params.detail_level || 'detailed';
    const focusAreas = params.focus_areas || [];

    ctx.log('thinking', `Generating ${numIdeas} paper ideas for: ${topic}`);

    try {
      // Step 1: Fetch papers from arXiv
      ctx.log('info', 'Fetching papers from arXiv...');
      const papers = await this.fetchFromArxiv(topic, maxPapers);
      ctx.log('info', `Found ${papers.length} papers`);

      if (papers.length === 0) {
        return { success: false, error: 'No papers found. Try a different topic.' };
      }

      // Step 2: Identify research gaps
      ctx.log('info', 'Identifying research gaps...');
      const gaps = this.identifyGaps(papers, topic, focusAreas);
      ctx.log('info', `Found ${gaps.length} potential gaps`);

      // Step 3: Generate ideas with batch processing
      ctx.log('info', 'Generating paper ideas...');
      const ideas: PaperIdea[] = [];
      const selectedGaps = gaps.slice(0, numIdeas);
      
      // Process in batches of 3 for better performance
      for (let i = 0; i < selectedGaps.length; i += 3) {
        const batch = selectedGaps.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map(gap => this.generateIdea(ctx, gap, topic, papers, language, detailLevel))
        );
        ideas.push(...batchResults);
        batchResults.forEach(idea => ctx.log('info', `✓ ${idea.title}`));
      }

      // Step 4: Sort and format
      ideas.sort((a, b) => b.score - a.score);
      const markdown = this.formatReport(ideas, topic, papers.length, language);

      return {
        success: true,
        ideas,
        papers_found: papers.length,
        gaps_identified: gaps.length,
        markdown,
        summary: {
          total_ideas: ideas.length,
          avg_score: Math.round(ideas.reduce((s, i) => s + i.score, 0) / ideas.length),
          top_score: ideas[0]?.score || 0
        }
      };
    } catch (error: any) {
      return { success: false, error: `Failed: ${error.message}` };
    }
  }

  private async fetchFromArxiv(topic: string, maxPapers: number): Promise<Paper[]> {
    const query = `all:${encodeURIComponent(topic)}`;
    const url = `http://export.arxiv.org/api/query?search_query=${query}&max_results=${maxPapers}&sortBy=relevance`;
    
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`arXiv error: ${response.status}`);
    
    return this.parseArxivXml(await response.text());
  }

  private parseArxivXml(xmlText: string): Paper[] {
    const papers: Paper[] = [];
    const entries = xmlText.split('<entry>');
    
    for (const entry of entries.slice(1)) {
      const title = this.extractTag(entry, 'title');
      const summary = this.extractTag(entry, 'summary');
      const published = this.extractTag(entry, 'published');
      const id = this.extractTag(entry, 'id');
      
      if (title && summary) {
        papers.push({
          title: title.trim().replace(/\n/g, ' '),
          authors: this.extractAuthors(entry),
          year: published ? parseInt(published.substring(0, 4)) : 0,
          abstract: summary.trim().replace(/\n/g, ' ').substring(0, 500),
          url: id?.trim() || ''
        });
      }
    }
    return papers;
  }

  private extractTag(entry: string, tag: string): string | null {
    const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1] : null;
  }

  private extractAuthors(entry: string): string[] {
    const authors: string[] = [];
    for (const match of entry.matchAll(/<name>([\s\S]*?)<\/name>/g)) {
      authors.push(match[1].trim());
    }
    return authors.slice(0, 5);
  }

  private identifyGaps(papers: Paper[], topic: string, focusAreas: string[]): { name: string; category: string; relevance: number }[] {
    const allText = papers.map(p => `${p.title} ${p.abstract}`).join(' ').toLowerCase();
    const gaps: { name: string; category: string; relevance: number }[] = [];
    
    const categoriesToCheck = focusAreas.length > 0 
      ? Object.entries(TECH_KEYWORDS).filter(([cat]) => focusAreas.some(f => f.toLowerCase().includes(cat)))
      : Object.entries(TECH_KEYWORDS);
    
    for (const [category, keywords] of categoriesToCheck) {
      for (const kw of keywords) {
        if (!new RegExp(kw.replace(/-/g, '[\\s-]?'), 'gi').test(allText)) {
          const relevance = topic.toLowerCase().includes(kw.replace(/-/g, ' ')) ? 80 : 50;
          gaps.push({ name: kw, category, relevance });
        }
      }
    }
    
    return gaps.sort((a, b) => b.relevance - a.relevance).slice(0, 15);
  }

  private async generateIdea(
    ctx: SkillContext,
    gap: { name: string; category: string; relevance: number },
    topic: string,
    papers: Paper[],
    language: string,
    detailLevel: string
  ): Promise<PaperIdea> {
    const relatedPapers = papers.filter(p => 
      p.title.toLowerCase().includes(topic.toLowerCase().split(' ')[0]) ||
      p.abstract.toLowerCase().includes(gap.category)
    ).slice(0, 3).map(p => p.title);
    
    const prompt = this.buildPrompt(gap, topic, relatedPapers, language, detailLevel);
    
    try {
      const response = await ctx.llm.complete(prompt);
      return this.parseResponse(response.content, gap, topic, relatedPapers);
    } catch {
      return this.templateIdea(gap, topic, relatedPapers);
    }
  }

  private buildPrompt(gap: { name: string; category: string }, topic: string, papers: string[], lang: string, detail: string): string {
    return `Generate a novel paper idea for "${topic}" addressing gap "${gap.name}" (${gap.category}).

Output ONLY valid JSON:
{
  "title": "English title",
  "title_zh": "Chinese title",
  "questions": ["Q1", "Q2", "Q3"],
  "method": "Core methodology",
  "experiments": [{"name": "Exp", "dataset": "Data", "baselines": ["B1"], "metrics": ["M1"]}],
  "contributions": ["C1", "C2"],
  "resources": ["R1"],
  "score": 85,
  "difficulty": "medium",
  "novelty": "moderate",
  "feasibility": "high",
  "timeline": "3-6 months"
}

Related papers: ${papers.join('; ')}`;
  }

  private parseResponse(content: string, gap: { name: string; category: string }, topic: string, papers: string[]): PaperIdea {
    let data: any = {};
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) data = JSON.parse(match[0]);
    } catch {}
    
    return {
      id: `idea_${Date.now()}`,
      title: data.title || `${gap.name} for ${topic}`,
      title_zh: data.title_zh || `${topic}中的${gap.name}研究`,
      research_gap: gap.name,
      research_gap_category: gap.category,
      research_questions: data.questions || [`How to implement ${gap.name} for ${topic}?`],
      core_method: data.method || '',
      experiments: data.experiments || [],
      expected_contributions: data.contributions || [],
      related_papers: papers,
      score: Math.min(Math.max(data.score || 75, 60), 100),
      difficulty: data.difficulty || 'medium',
      novelty: data.novelty || 'moderate',
      feasibility: data.feasibility || 'high',
      timeline: data.timeline || '3-6 months',
      resources_needed: data.resources || []
    };
  }

  private templateIdea(gap: { name: string; category: string }, topic: string, papers: string[]): PaperIdea {
    return {
      id: `idea_${Date.now()}`,
      title: `${gap.name} for ${topic}`,
      title_zh: `${topic}中的${gap.name}研究`,
      research_gap: gap.name,
      research_gap_category: gap.category,
      research_questions: [`How to implement ${gap.name} for ${topic}?`],
      core_method: `Design ${gap.name} approach for ${topic}`,
      experiments: [{ name: 'Eval', dataset: 'Benchmark', baselines: ['Baseline'], metrics: ['Accuracy'] }],
      expected_contributions: ['Novel method', 'Evaluation'],
      related_papers: papers,
      score: 75,
      difficulty: 'medium',
      novelty: 'moderate',
      feasibility: 'high',
      timeline: '3-6 months',
      resources_needed: ['GPU', 'Dataset']
    };
  }

  private formatReport(ideas: PaperIdea[], topic: string, paperCount: number, lang: string): string {
    const lines = [
      `# 📝 论文点子生成报告`,
      ``,
      `**主题**: ${topic} | **论文**: ${paperCount} | **点子**: ${ideas.length}`,
      ``,
      `---\n`
    ];
    
    ideas.forEach((idea, i) => {
      lines.push(`## 💡 ${i + 1}. ${idea.title}`);
      if (lang !== 'en' && idea.title_zh) lines.push(`**中文**: ${idea.title_zh}`);
      lines.push(``);
      lines.push(`**空白**: ${idea.research_gap} | **评分**: ${idea.score}`);
      lines.push(``);
      lines.push(`### 研究问题`);
      idea.research_questions.forEach(q => lines.push(`- ${q}`));
      lines.push(``);
      lines.push(`### 核心方法`);
      lines.push(idea.core_method);
      lines.push(``);
      lines.push(`### 评估: ${idea.difficulty} | ${idea.novelty} | ${idea.feasibility} | ${idea.timeline}`);
      lines.push(``);
      if (idea.related_papers.length) {
        lines.push(`### 参考: ${idea.related_papers.slice(0, 2).join('; ')}`);
      }
      lines.push(`\n---\n`);
    });
    
    return lines.join('\n');
  }
}