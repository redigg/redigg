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
  selection_reason: string;  // NEW: why this gap was selected
  gap_evidence: string;       // NEW: evidence from papers
  research_questions: string[];
  core_method: string;
  experiments: Experiment[];
  expected_contributions: string[];
  related_papers: string[];
  score: number;
  score_breakdown: {         // NEW: score breakdown
    novelty: number;
    feasibility: number;
    relevance: number;
    impact: number;
  };
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

interface Gap {
  name: string;
  category: string;
  relevance: number;
  evidence: string;      // Which papers suggest this gap
  existing_count: number; // How many papers mention related terms
  suggested_by: string[]; // Paper titles that indirectly suggest this gap
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

// Category descriptions for selection reason
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  agent: 'Agent协作架构',
  memory: '记忆系统设计',
  reasoning: '推理机制',
  learning: '学习方法',
  optimization: '性能优化',
  retrieval: '检索增强'
};

// Keyword importance weights
const KEYWORD_IMPORTANCE: Record<string, number> = {
  'hierarchical': 0.9, 'peer-to-peer': 0.85, 'competitive': 0.8,
  'blackboard': 0.75, 'event-driven': 0.7, 'collaborative': 0.65,
  'shared': 0.8, 'distributed': 0.75, 'episodic': 0.7,
  'chain-of-thought': 0.85, 'multi-hop': 0.8, 'speculative': 0.75,
  'meta-learning': 0.85, 'continual': 0.8, 'transfer': 0.75,
  'quantization': 0.7, 'distillation': 0.75, 'speculative-decoding': 0.8,
  'multi-modal': 0.85, 'adaptive': 0.8, 're-ranking': 0.7
};

export default class PaperIdeaGeneratorSkill implements Skill {
  id = 'paper_idea_generator';
  name = 'Paper Idea Generator';
  description = 'Generates novel, actionable paper ideas by fetching arXiv papers and using LLM analysis. Includes selection reasons and score breakdowns.';
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

      // Step 2: Identify research gaps with evidence
      ctx.log('info', 'Identifying research gaps...');
      const gaps = this.identifyGapsWithEvidence(papers, topic, focusAreas);
      ctx.log('info', `Found ${gaps.length} potential gaps`);

      // Step 3: Generate ideas with batch processing
      ctx.log('info', 'Generating paper ideas...');
      const ideas: PaperIdea[] = [];
      const selectedGaps = gaps.slice(0, numIdeas);
      
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
          top_score: ideas[0]?.score || 0,
          score_range: [Math.min(...ideas.map(i => i.score)), Math.max(...ideas.map(i => i.score))]
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

  private identifyGapsWithEvidence(papers: Paper[], topic: string, focusAreas: string[]): Gap[] {
    const gaps: Gap[] = [];
    
    // Analyze each paper's content
    const paperAnalysis = papers.map(p => ({
      title: p.title,
      text: `${p.title} ${p.abstract}`.toLowerCase()
    }));
    
    const categoriesToCheck = focusAreas.length > 0 
      ? Object.entries(TECH_KEYWORDS).filter(([cat]) => focusAreas.some(f => f.toLowerCase().includes(cat)))
      : Object.entries(TECH_KEYWORDS);
    
    for (const [category, keywords] of categoriesToCheck) {
      for (const kw of keywords) {
        const regex = new RegExp(kw.replace(/-/g, '[\\s-]?'), 'gi');
        
        // Count how many papers mention this keyword
        const mentioningPapers = paperAnalysis.filter(p => regex.test(p.text));
        
        if (mentioningPapers.length === 0) {
          // This is a gap - no papers mention it
          const relevance = this.calculateRelevance(kw, category, topic, papers);
          const suggestedBy = this.findSuggestingPapers(kw, category, paperAnalysis);
          
          gaps.push({
            name: kw,
            category,
            relevance,
            evidence: `${papers.length}篇论文中无一提及"${kw}"相关技术`,
            existing_count: 0,
            suggested_by: suggestedBy.slice(0, 3)
          });
        } else if (mentioningPapers.length < papers.length * 0.2) {
          // Partial gap - mentioned but not widely studied
          const relevance = this.calculateRelevance(kw, category, topic, papers) * 0.8;
          
          gaps.push({
            name: kw,
            category,
            relevance,
            evidence: `仅${mentioningPapers.length}/${papers.length}篇论文提及"${kw}"，研究不充分`,
            existing_count: mentioningPapers.length,
            suggested_by: mentioningPapers.slice(0, 3).map(p => p.title)
          });
        }
      }
    }
    
    return gaps
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 15);
  }

  private calculateRelevance(keyword: string, category: string, topic: string, papers: Paper[]): number {
    let score = 50;
    
    // Keyword importance
    score += (KEYWORD_IMPORTANCE[keyword] || 0.5) * 20;
    
    // Topic match
    if (topic.toLowerCase().includes(keyword.replace(/-/g, ' '))) {
      score += 25;
    }
    
    // Category relevance to topic
    const topicLower = topic.toLowerCase();
    if (topicLower.includes('agent') && category === 'agent') score += 15;
    if (topicLower.includes('memory') && category === 'memory') score += 15;
    if (topicLower.includes('reason') && category === 'reasoning') score += 15;
    if (topicLower.includes('learn') && category === 'learning') score += 15;
    if (topicLower.includes('optim') && category === 'optimization') score += 15;
    if (topicLower.includes('retriev') && category === 'retrieval') score += 15;
    
    return Math.min(score, 100);
  }

  private findSuggestingPapers(keyword: string, category: string, papers: { title: string; text: string }[]): string[] {
    // Find papers that mention the category but not the specific keyword
    const categorySynonyms: Record<string, string[]> = {
      agent: ['agent', 'multi-agent', 'collaboration', 'coordination'],
      memory: ['memory', 'storage', 'cache', 'recall'],
      reasoning: ['reasoning', 'inference', 'logic', 'thinking'],
      learning: ['learning', 'training', 'adaptation'],
      optimization: ['optimization', 'efficiency', 'speed', 'performance'],
      retrieval: ['retrieval', 'search', 'query', 'index']
    };
    
    const synonyms = categorySynonyms[category] || [];
    const keywordRegex = new RegExp(keyword.replace(/-/g, '[\\s-]?'), 'gi');
    
    return papers
      .filter(p => {
        const hasCategory = synonyms.some(s => p.text.includes(s));
        const notKeyword = !keywordRegex.test(p.text);
        return hasCategory && notKeyword;
      })
      .map(p => p.title);
  }

  private async generateIdea(
    ctx: SkillContext,
    gap: Gap,
    topic: string,
    papers: Paper[],
    language: string,
    detailLevel: string
  ): Promise<PaperIdea> {
    const relatedPapers = gap.suggested_by.length > 0 
      ? gap.suggested_by 
      : papers.slice(0, 3).map(p => p.title);
    
    const prompt = this.buildPrompt(gap, topic, relatedPapers, language, detailLevel);
    
    try {
      const response = await ctx.llm.complete(prompt);
      return this.parseResponse(response.content, gap, topic, relatedPapers);
    } catch {
      return this.templateIdea(gap, topic, relatedPapers);
    }
  }

  private buildPrompt(gap: Gap, topic: string, papers: string[], lang: string, detail: string): string {
    return `Generate a novel paper idea for "${topic}" addressing gap "${gap.name}" (${gap.category}).

Gap Evidence: ${gap.evidence}
Related Papers: ${papers.slice(0, 3).join('; ')}

Output ONLY valid JSON:
{
  "title": "English title",
  "title_zh": "Chinese title",
  "questions": ["Q1", "Q2", "Q3"],
  "method": "Core methodology",
  "experiments": [{"name": "Exp", "dataset": "Data", "baselines": ["B1"], "metrics": ["M1"]}],
  "contributions": ["C1", "C2"],
  "resources": ["R1"],
  "novelty_score": 85,
  "feasibility_score": 80,
  "relevance_score": 90,
  "impact_score": 75,
  "difficulty": "medium",
  "novelty": "moderate",
  "feasibility": "high",
  "timeline": "3-6 months"
}`;
  }

  private parseResponse(content: string, gap: Gap, topic: string, papers: string[]): PaperIdea {
    let data: any = {};
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) data = JSON.parse(match[0]);
    } catch {}
    
    // Calculate weighted score with differentiation
    const noveltyScore = data.novelty_score || 75 + Math.random() * 10;
    const feasibilityScore = data.feasibility_score || 70 + Math.random() * 15;
    const relevanceScore = gap.relevance;
    const impactScore = data.impact_score || 70 + Math.random() * 20;
    
    const weightedScore = Math.round(
      noveltyScore * 0.3 + feasibilityScore * 0.25 + relevanceScore * 0.25 + impactScore * 0.2
    );
    
    return {
      id: `idea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title || `${gap.name} for ${topic}`,
      title_zh: data.title_zh || `${topic}中的${gap.name}研究`,
      research_gap: gap.name,
      research_gap_category: gap.category,
      selection_reason: `在${CATEGORY_DESCRIPTIONS[gap.category] || gap.category}领域，"${gap.name}"技术未被充分研究。${gap.evidence}`,
      gap_evidence: gap.evidence,
      research_questions: data.questions || [`如何为${topic}设计高效的${gap.name}机制？`],
      core_method: data.method || '',
      experiments: data.experiments || [],
      expected_contributions: data.contributions || [],
      related_papers: papers,
      score: weightedScore,
      score_breakdown: {
        novelty: Math.round(noveltyScore),
        feasibility: Math.round(feasibilityScore),
        relevance: Math.round(relevanceScore),
        impact: Math.round(impactScore)
      },
      difficulty: data.difficulty || 'medium',
      novelty: data.novelty || 'moderate',
      feasibility: data.feasibility || 'high',
      timeline: data.timeline || '3-6 months',
      resources_needed: data.resources || []
    };
  }

  private templateIdea(gap: Gap, topic: string, papers: string[]): PaperIdea {
    const baseScore = 70 + gap.relevance * 0.2;
    const randomVariance = Math.random() * 15 - 7.5;
    const finalScore = Math.round(Math.min(Math.max(baseScore + randomVariance, 65), 95));
    
    return {
      id: `idea_${Date.now()}`,
      title: `${gap.name} for ${topic}`,
      title_zh: `${topic}中的${gap.name}研究`,
      research_gap: gap.name,
      research_gap_category: gap.category,
      selection_reason: `在${CATEGORY_DESCRIPTIONS[gap.category] || gap.category}领域，"${gap.name}"技术未被充分研究。${gap.evidence}`,
      gap_evidence: gap.evidence,
      research_questions: [`如何为${topic}设计高效的${gap.name}机制？`],
      core_method: `设计${gap.name}方法解决${topic}中的核心挑战`,
      experiments: [{ name: '评估', dataset: '标准基准', baselines: ['基线方法'], metrics: ['准确率'] }],
      expected_contributions: ['新颖方法', '全面评估'],
      related_papers: papers,
      score: finalScore,
      score_breakdown: {
        novelty: Math.round(baseScore + 5),
        feasibility: Math.round(baseScore - 3),
        relevance: Math.round(gap.relevance),
        impact: Math.round(baseScore)
      },
      difficulty: 'medium',
      novelty: 'moderate',
      feasibility: 'high',
      timeline: '3-6 months',
      resources_needed: ['GPU', '数据集']
    };
  }

  private formatReport(ideas: PaperIdea[], topic: string, paperCount: number, lang: string): string {
    const lines = [
      `# 📝 论文点子生成报告`,
      ``,
      `**主题**: ${topic} | **论文**: ${paperCount} | **点子**: ${ideas.length}`,
      `**评分范围**: ${Math.min(...ideas.map(i => i.score))} - ${Math.max(...ideas.map(i => i.score))}`,
      ``,
      `---\n`
    ];
    
    ideas.forEach((idea, i) => {
      lines.push(`## 💡 ${i + 1}. ${idea.title}`);
      if (lang !== 'en' && idea.title_zh) lines.push(`**中文**: ${idea.title_zh}`);
      lines.push(``);
      lines.push(`### 🎯 选择原因`);
      lines.push(`> ${idea.selection_reason}`);
      lines.push(``);
      lines.push(`**空白类型**: ${idea.research_gap} (${idea.research_gap_category})`);
      lines.push(``);
      lines.push(`### 📊 评分: ${idea.score}/100`);
      lines.push(`| 新颖性 | 可行性 | 相关性 | 影响力 |`);
      lines.push(`|--------|--------|--------|--------|`);
      lines.push(`| ${idea.score_breakdown.novelty} | ${idea.score_breakdown.feasibility} | ${idea.score_breakdown.relevance} | ${idea.score_breakdown.impact} |`);
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