import * as fs from 'fs';
import * as path from 'path';
import { promptManager } from '../utils/prompt-manager';

export interface SkillContext {
  llm: any; // Type as LLMProvider
  workspace: string;
  research_id?: string;
  step_number?: number;
  agent_id?: string;
  agent_name?: string;
  log: (
    type: 'thinking' | 'action' | 'tool_call' | 'tool_result' | 'result' | 'error' | 'token' | 'reasoning_token',
    content: string,
    metadata?: any
  ) => void | Promise<void>;
  updateProgress?: (progress: number, description: string, details?: any) => Promise<void>;
  updateTodo?: (todoId: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled', content?: string) => Promise<void>;
  addTodo?: (content: string, priority: 'high' | 'medium' | 'low', step_number?: number) => Promise<void>;
  invokeSkill?: (name: string, params: any) => Promise<any>;
  listSkills?: () => Promise<{ name: string; description: string }[]>;
}

export interface Skill {
  name: string;
  description: string;
  execute: (context: SkillContext, params: any) => Promise<any>;
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  get(name: string) {
    return this.skills.get(name);
  }

  list() {
    return Array.from(this.skills.values());
  }

  all() {
    return Array.from(this.skills.values());
  }
}

type SkillLogType = 'thinking' | 'action' | 'tool_call' | 'tool_result' | 'result' | 'error';

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function firstN(text: string, n = 220): string {
  const clean = toText(text, '');
  if (!clean) return '';
  if (clean.length <= n) return clean;
  return `${clean.slice(0, n)}...`;
}

export function extractBulletList(markdown: string, fallbackPrefix: string): string[] {
  const lines = markdown.split('\n').map((line) => line.trim());
  const bullets = lines
    .filter((line) => /^([-*]|\d+\.)\s+/.test(line))
    .map((line) => line.replace(/^([-*]|\d+\.)\s+/, '').trim())
    .filter((line) => line.length > 0);
  if (bullets.length > 0) return bullets.slice(0, 8);
  if (!markdown.trim()) return [];
  return [`${fallbackPrefix}: ${firstN(markdown, 120)}`];
}

async function safeLog(ctx: SkillContext, type: SkillLogType, content: string, metadata?: unknown) {
  try {
    await Promise.resolve(ctx.log(type, content, metadata));
  } catch {
    // Keep skill execution resilient even if logging endpoint fails.
  }
}

async function safeProgress(ctx: SkillContext, progress: number, description: string, details?: unknown) {
  if (!ctx.updateProgress) return;
  try {
    await ctx.updateProgress(progress, description, details);
  } catch {
    // Ignore progress failures to avoid interrupting core task execution.
  }
}

async function safeAddTodo(
  ctx: SkillContext,
  content: string,
  priority: 'high' | 'medium' | 'low',
  stepNumber?: number
) {
  if (!ctx.addTodo) return;
  try {
    await ctx.addTodo(content, priority, stepNumber);
  } catch {
    // Ignore todo persistence failure.
  }
}

function joinReferences(references: unknown): string {
  if (!Array.isArray(references)) return '';
  return references
    .map((item) => toText(item, ''))
    .filter((item) => item.length > 0)
    .join('\n');
}

// Built-in Skills
export const LiteratureReviewSkill: Skill = {
  name: 'literature_review',
  description: 'Iteratively search for papers and generate a comprehensive literature review',
  execute: async (ctx, params) => {
    const topic = toText(params?.topic, 'General research topic');

    await safeLog(ctx, 'thinking', `Starting iterative literature review on: ${topic}`);
    await safeProgress(ctx, 10, 'Initializing search strategy');

    const { ScholarSearch } = await import('../utils/scholar-search');
    const { arxivSearch } = await import('../utils/arxiv-search');
    const scholar = new ScholarSearch();

    let allPapers: any[] = [];
    let visitedTitles = new Set<string>();
    let queries = [topic];
    let iteration = 0;
    const MAX_ITERATIONS = 3;
    const TARGET_PAPERS = 15;

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        await safeLog(ctx, 'action', `Iteration ${iteration}: Searching for "${queries.join('", "')}"`);
        
        // Parallel search with source tracking
        const searchPromises = queries.flatMap(q => [
            arxivSearch.searchPapers(q, 10).then(res => ({ source: 'ArXiv', res })),
            // scholar.searchPapers(q, 5).then(res => ({ source: 'Scholar', res }))
        ]);

        const results = await Promise.all(searchPromises);
        
        let newPapersTotal = 0;
        
        for (const { source, res } of results) {
            let sourceNew = 0;
            for (const p of res) {
                const normTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!visitedTitles.has(normTitle)) {
                    visitedTitles.add(normTitle);
                    allPapers.push(p);
                    sourceNew++;
                    newPapersTotal++;
                }
            }
            if (res.length > 0) {
                await safeLog(ctx, 'tool_result', `Found ${res.length} papers from ${source} (${sourceNew} new).`);
            }
        }

        await safeLog(ctx, 'thinking', `Iteration ${iteration} Summary: ${newPapersTotal} new papers. Total collection: ${allPapers.length}`);

        // Save references incrementally
        if (ctx.workspace) {
             try {
                 const refPath = path.resolve(ctx.workspace, 'references.json');
                 const mdPath = path.resolve(ctx.workspace, 'references.md');
                 
                 if (!fs.existsSync(ctx.workspace)) fs.mkdirSync(ctx.workspace, { recursive: true });
                 
                 let existingRefs: any[] = [];
                 if (fs.existsSync(refPath)) {
                     try { existingRefs = JSON.parse(fs.readFileSync(refPath, 'utf-8')); } catch(e) {}
                 }
                 
                 const refMap = new Map();
                 existingRefs.forEach((p: any) => refMap.set(p.title.toLowerCase().replace(/[^a-z0-9]/g, ''), p));
                 allPapers.forEach(p => refMap.set(p.title.toLowerCase().replace(/[^a-z0-9]/g, ''), p));
                 
                 const mergedRefs = Array.from(refMap.values());
                 fs.writeFileSync(refPath, JSON.stringify(mergedRefs, null, 2));
                 
                 const mdContent = `# Research References\n\n${mergedRefs.map((p, i) => 
                     `${i+1}. **${p.title}**\n   - Authors: ${p.authors.join(', ')}\n   - Venue: ${p.venue} (${p.year})\n   - Link: ${p.url || 'N/A'}`
                 ).join('\n\n')}`;
                 fs.writeFileSync(mdPath, mdContent);
                 
                 await safeLog(ctx, 'action', `Saved ${mergedRefs.length} references to workspace.`);
             } catch (e) {
                 // ignore save errors
             }
        }

        if (allPapers.length >= TARGET_PAPERS) {
            await safeLog(ctx, 'thinking', 'Sufficient papers collected.');
            break;
        }

        if (iteration < MAX_ITERATIONS) {
             const titles = allPapers.map(p => `- ${p.title}`).join('\n');
             const prompt = promptManager.get('literature_review_query', { topic, titles });

             const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
             const content = toText(response?.content, '').trim();
             
             if (content.includes('NO_MORE_SEARCH')) break;
             
             const newQueries = content.split('\n')
                .map(q => q.trim().replace(/^-\s*/, '').replace(/"/g, ''))
                .filter(q => q && !queries.includes(q) && q.length > 3);
             
             if (newQueries.length === 0) break;
             queries = newQueries;
             await safeLog(ctx, 'thinking', `Refining search: ${queries.join(', ')}`);
        }
    }

    if (allPapers.length === 0) {
      const summary = `No relevant papers found for "${topic}".`;
      await safeLog(ctx, 'error', summary);
      return { topic, summary, papers: [], references: [], paper_count: 0 };
    }

    await safeProgress(ctx, 50, 'Synthesizing retrieved papers');
    
    const papersContext = allPapers.slice(0, 20).map((paper, index) => {
        return `[Paper ${index + 1}]
Title: ${paper.title}
Authors: ${paper.authors.join(', ')}
Year: ${paper.year}
Venue: ${paper.venue}
Abstract: ${paper.abstract || 'No abstract available'}`;
      }).join('\n\n');

    const prompt = promptManager.get('literature_review_synthesis', { topic, papersContext });

    await safeLog(ctx, 'tool_call', 'Generating review', { tool_name: 'LLM' });
    const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
    const summary = toText(response?.content, '');

    await safeLog(ctx, 'tool_result', 'Generated review', { output_length: summary.length });
    
    const references = allPapers.map((paper) => scholar.formatCitation(paper));

    await safeProgress(ctx, 100, 'Review completed');
    
    if (ctx.workspace) {
        await safeLog(ctx, 'result', `Review complete. Saved ${allPapers.length} unique references to workspace/references.md`);
    }

    return {
      topic,
      summary,
      papers: allPapers,
      references,
      key_findings: extractBulletList(summary, 'Finding'),
      next_steps: 'Convert findings into plan.',
      paper_count: allPapers.length,
    };
  },
};

export const ResearchPlanningSkill: Skill = {
  name: 'research_planning',
  description: 'Generate a structured research plan with hypotheses, milestones, and risks',
  execute: async (ctx, params) => {
    const topic = toText(params?.topic, 'General research topic');
    const context = toText(params?.context, '');
    const constraints = toText(params?.constraints, '');

    await safeLog(ctx, 'thinking', `Planning research workflow for topic: ${topic}`);
    await safeProgress(ctx, 15, 'Creating research plan');

    const prompt = promptManager.get('research_planning', { 
        topic, 
        context: context || 'N/A', 
        constraints: constraints || 'N/A' 
    });

    await safeLog(ctx, 'tool_call', 'Generating research plan with LLM', {
      tool_name: 'LLM',
      prompt_length: prompt.length,
    });

    const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
    const plan = toText(response?.content, '');

    await safeProgress(ctx, 100, 'Research plan completed');
    await safeLog(ctx, 'result', `Generated research plan for ${topic}`, {
      output_length: plan.length,
    });
    await safeAddTodo(ctx, 'Validate plan feasibility with domain experts', 'medium', ctx.step_number);

    return {
      topic,
      plan,
      summary: plan,
      milestones: extractBulletList(plan, 'Milestone'),
      next_steps: 'Start literature review and protocol drafting based on this plan.',
    };
  },
};

export const ExperimentDesignSkill: Skill = {
  name: 'experiment_design',
  description: 'Design rigorous experiments including controls, metrics, and ablations',
  execute: async (ctx, params) => {
    const topic = toText(params?.topic, 'General experiment');
    const requirements = toText(params?.requirements, '');
    const hypothesis = toText(params?.hypothesis, '');

    await safeLog(ctx, 'thinking', `Designing experiment for topic: ${topic}`);
    await safeProgress(ctx, 20, 'Designing experiment protocol');

    const prompt = promptManager.get('experiment_design', {
        topic,
        hypothesis: hypothesis || 'N/A',
        requirements: requirements || 'N/A'
    });

    await safeLog(ctx, 'tool_call', 'Generating experiment design with LLM', {
      tool_name: 'LLM',
      prompt_length: prompt.length,
    });

    const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
    const design = toText(response?.content, '');

    await safeProgress(ctx, 100, 'Experiment design completed');
    await safeLog(ctx, 'result', `Generated experiment design for ${topic}`, {
      output_length: design.length,
    });
    await safeAddTodo(ctx, 'Pre-register primary metrics and stopping conditions', 'high', ctx.step_number);

    return {
      topic,
      design,
      summary: design,
      key_findings: extractBulletList(design, 'Design point'),
      next_steps: 'Prepare datasets/materials and run a pilot experiment.',
    };
  },
};

export const DataAnalysisSkill: Skill = {
  name: 'data_analysis',
  description: 'Analyze data with assumptions, methods, and statistically grounded conclusions',
  execute: async (ctx, params) => {
    const requirements = toText(params?.requirements, '');
    const data = toText(params?.data, '');
    const topic = toText(params?.topic, requirements || 'Data analysis');

    await safeLog(ctx, 'thinking', `Analyzing data for: ${topic}`);
    await safeProgress(ctx, 20, 'Starting data analysis');

    const prompt = promptManager.get('data_analysis', {
        topic,
        requirements: requirements || 'N/A',
        data: data || 'N/A'
    });

    await safeLog(ctx, 'tool_call', 'Generating data analysis with LLM', {
      tool_name: 'LLM',
      prompt_length: prompt.length,
    });

    const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
    const analysis = toText(response?.content, '');

    await safeProgress(ctx, 100, 'Data analysis completed');
    await safeLog(ctx, 'result', `Generated data analysis for ${topic}`, {
      output_length: analysis.length,
    });
    await safeAddTodo(ctx, 'Run sensitivity checks for top conclusions', 'medium', ctx.step_number);

    return {
      topic,
      analysis,
      summary: analysis,
      key_findings: extractBulletList(analysis, 'Result'),
      next_steps: 'Cross-validate findings and prepare result visualizations.',
    };
  },
};

export const PaperWritingSkill: Skill = {
  name: 'paper_writing',
  description: 'Draft a full research manuscript in IMRaD format with references and limitations',
  execute: async (ctx, params) => {
    const topic = toText(params?.topic || params?.title, 'Untitled Research');
    const context = toText(params?.context, '');
    const keyFindings = toText(params?.key_findings, '');
    const references = joinReferences(params?.references);
    const targetVenue = toText(params?.target_venue, '');

    await safeLog(ctx, 'thinking', `Drafting research paper for topic: ${topic}`);
    await safeProgress(ctx, 20, 'Starting manuscript drafting');

    const prompt = promptManager.get('paper_writing', {
        topic,
        context: context || 'N/A',
        keyFindings: keyFindings || 'N/A',
        references: references || 'N/A',
        targetVenue: targetVenue || 'General scientific journal'
    });

    await safeLog(ctx, 'tool_call', 'Generating manuscript with LLM', {
      tool_name: 'LLM',
      prompt_length: prompt.length,
    });

    const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
    const manuscript = toText(response?.content, '');

    await safeProgress(ctx, 100, 'Manuscript drafting completed');
    await safeLog(ctx, 'result', `Generated manuscript for ${topic}`, {
      output_length: manuscript.length,
    });
    await safeAddTodo(ctx, 'Run plagiarism and citation consistency check before submission', 'high', ctx.step_number);

    return {
      topic,
      manuscript,
      summary: manuscript,
      abstract: firstN(manuscript, 600),
      key_findings: extractBulletList(manuscript, 'Contribution'),
      next_steps: 'Perform internal peer review and revise language/figures.',
    };
  },
};

export const PeerReviewSkill: Skill = {
  name: 'peer_review',
  description: 'Review a research proposal',
  execute: async (ctx, params) => {
    const proposal = toText(params?.proposal, '');

    await safeLog(ctx, 'thinking', 'Starting peer review of research proposal');
    await safeProgress(ctx, 20, 'Preparing peer review');

    const prompt = promptManager.get('peer_review', { proposal });

    await safeLog(ctx, 'tool_call', 'Generating peer review with LLM', {
      tool_name: 'LLM',
      prompt_length: prompt.length,
    });

    const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
    const review = toText(response?.content, '');
    const decision = extractDecision(review);

    await safeProgress(ctx, 100, 'Peer review completed');
    await safeLog(ctx, 'result', `Completed peer review with decision: ${decision}`, {
      review_length: review.length,
      decision,
    });

    return {
      review,
      decision,
      summary: review,
      key_findings: extractBulletList(review, 'Review point'),
    };
  },
};

function extractDecision(reviewText: string): string {
  const lowerText = reviewText.toLowerCase();

  if (lowerText.includes('accept')) return 'Accept';
  if (lowerText.includes('minor revision')) return 'Minor Revision';
  if (lowerText.includes('major revision')) return 'Major Revision';
  if (lowerText.includes('reject')) return 'Reject';

  return 'Major Revision';
}

export const ResearchHighlightExtractionSkill: Skill = {
  name: 'research_highlight_extraction',
  description: 'Extract key highlights and takeaways from research papers or reports',
  execute: async (ctx, params) => {
    const text = toText(params?.text, '');
    const sourceType = toText(params?.source_type, 'paper');

    await safeLog(ctx, 'thinking', 'Starting research highlight extraction');
    await safeProgress(ctx, 10, 'Initializing highlight extractor');

    if (!text || text.trim().length === 0) {
      const errorMessage = 'No text provided for highlight extraction.';
      await safeLog(ctx, 'error', errorMessage);
      await safeProgress(ctx, 100, 'Highlight extraction failed');
      return {
        original_text: text,
        highlights: [],
        error: errorMessage,
      };
    }

    await safeLog(ctx, 'tool_call', 'Extracting highlights with LLM', {
      tool_name: 'LLM',
      text_length: text.length,
      source_type: sourceType,
    });

    const prompt = promptManager.get('highlight_extraction', { sourceType, text });

    const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
    const highlights = toText(response?.content, '');

    await safeLog(ctx, 'tool_result', 'Extracted highlights successfully', {
      tool_name: 'LLM',
      original_length: text.length,
      highlights_length: highlights.length,
    });

    await safeProgress(ctx, 100, 'Highlight extraction completed');
    await safeLog(ctx, 'result', 'Completed research highlight extraction', {
      original_length: text.length,
      highlights_length: highlights.length,
    });

    return {
      original_text: text,
      highlights,
      source_type: sourceType,
      summary: 'Extracted key highlights and takeaways from the research text.',
      key_findings: extractBulletList(highlights, 'Highlight'),
      next_steps: 'Use highlights to create social media posts or research summaries.',
    };
  },
};

export const GrammarAndPolishingSkill: Skill = {
  name: 'grammar_and_polishing',
  description: 'Check grammar and polish academic writing',
  execute: async (ctx, params) => {
    const text = toText(params?.text, '');
    const tone = toText(params?.tone, 'academic');
    const language = toText(params?.language, 'en');

    await safeLog(ctx, 'thinking', 'Starting grammar and polishing');
    await safeProgress(ctx, 10, 'Initializing grammar checker');

    if (!text || text.trim().length === 0) {
      const errorMessage = 'No text provided for grammar and polishing.';
      await safeLog(ctx, 'error', errorMessage);
      await safeProgress(ctx, 100, 'Grammar and polishing failed');
      return {
        original_text: text,
        polished_text: '',
        changes: [],
        error: errorMessage,
      };
    }

    await safeLog(ctx, 'tool_call', 'Polishing text with LLM', {
      tool_name: 'LLM',
      text_length: text.length,
      tone,
      language,
    });

    const prompt = promptManager.get('grammar_polishing', { tone, language, text });

    const response = await ctx.llm.generateCompletion([{ role: 'user', content: prompt }]);
    const polishedText = toText(response?.content, '');

    await safeLog(ctx, 'tool_result', 'Polished text successfully', {
      tool_name: 'LLM',
      original_length: text.length,
      polished_length: polishedText.length,
    });

    await safeProgress(ctx, 100, 'Grammar and polishing completed');
    await safeLog(ctx, 'result', 'Completed grammar and polishing', {
      original_length: text.length,
      polished_length: polishedText.length,
    });

    return {
      original_text: text,
      polished_text: polishedText,
      tone,
      language,
      summary: 'Polished text for clarity, grammar, and academic tone.',
      key_findings: ['Improved grammar and clarity', 'Adjusted tone for academic writing'],
      next_steps: 'Incorporate polished text into research report or manuscript.',
    };
  },
};

export const DataVisualizationSkill: Skill = {
  name: 'data_visualization',
  description: 'Generate charts and visualizations from research data',
  execute: async (ctx, params) => {
    const data = params?.data || [];
    const chartType = toText(params?.chart_type, 'bar');
    const title = toText(params?.title, 'Research Data Visualization');
    const xAxis = toText(params?.x_axis, 'x');
    const yAxis = toText(params?.y_axis, 'y');

    await safeLog(ctx, 'thinking', `Starting data visualization for ${data.length} data points`);
    await safeProgress(ctx, 10, 'Initializing chart generator');

    await safeLog(ctx, 'tool_call', 'Generating visualization', {
      tool_name: 'DataVisualizer',
      data_points: data.length,
      chart_type: chartType,
    });

    // For now, generate a simple description and JSON structure
    // In the future, could integrate with Chart.js, matplotlib, etc.
    const visualization = {
      title,
      chart_type: chartType,
      x_axis: xAxis,
      y_axis: yAxis,
      data: data,
      description: `Generated ${chartType} chart for ${title} with ${data.length} data points.`,
    };

    await safeLog(ctx, 'tool_result', 'Generated visualization successfully', {
      tool_name: 'DataVisualizer',
      data_points: data.length,
    });

    await safeProgress(ctx, 100, 'Data visualization completed');
    await safeLog(ctx, 'result', `Completed data visualization for ${title}`, {
      data_points: data.length,
      chart_type: chartType,
    });

    return {
      title,
      chart_type: chartType,
      x_axis: xAxis,
      y_axis: yAxis,
      data,
      visualization,
      summary: visualization.description,
      key_findings: [`Visualized ${data.length} data points using ${chartType} chart`],
      next_steps: 'Embed visualization in research report or presentation.',
      data_points: data.length,
    };
  },
};

export const CitationFormattingSkill: Skill = {
  name: 'citation_formatting',
  description: 'Format citations and bibliographies in APA, MLA, Chicago, or IEEE style',
  execute: async (ctx, params) => {
    const papers = params?.papers || [];
    const style = toText(params?.style, 'apa');
    const outputType = toText(params?.output_type, 'bibliography');

    await safeLog(ctx, 'thinking', `Starting citation formatting for ${papers.length} papers in ${style} style`);
    await safeProgress(ctx, 10, 'Initializing citation formatter');

    // Import citation-js
    const Cite = require('citation-js');

    await safeLog(ctx, 'tool_call', 'Formatting citations', {
      tool_name: 'citation-js',
      papers_count: papers.length,
      style,
      output_type: outputType,
    });

    try {
      // Convert papers to CSL JSON (Citation Style Language)
      const cslData = papers.map((paper: any) => ({
        id: paper.id || `paper-${Date.now()}`,
        type: 'article-journal',
        title: paper.title,
        author: (paper.authors || []).map((name: string) => {
          const parts = name.split(' ');
          return {
            family: parts[parts.length - 1],
            given: parts.slice(0, -1).join(' '),
          };
        }),
        issued: { 'date-parts': [[paper.year]] },
        'container-title': paper.venue || 'Unknown Venue',
        DOI: paper.doi || '',
        URL: paper.url || '',
      }));

      const cite = new Cite(cslData);

      let result;
      if (outputType === 'bibliography') {
        result = cite.format('bibliography', {
          format: 'text',
          template: style,
          lang: 'en-US',
        });
      } else if (outputType === 'bibtex') {
        result = cite.format('bibtex');
      } else {
        // Default to bibliography
        result = cite.format('bibliography', {
          format: 'text',
          template: style,
          lang: 'en-US',
        });
      }

      await safeLog(ctx, 'tool_result', 'Formatted citations successfully', {
        tool_name: 'citation-js',
        papers_count: papers.length,
        output_length: result.length,
      });

      await safeProgress(ctx, 100, 'Citation formatting completed');
      await safeLog(ctx, 'result', `Formatted ${papers.length} citations in ${style} style`, {
        papers_count: papers.length,
        style,
      });

      return {
        papers,
        style,
        output_type: outputType,
        citations: outputType === 'bibliography' ? result.split('\n').filter((line: string) => line.trim().length > 0) : [],
        bibtex: outputType === 'bibtex' ? result : '',
        full_output: result,
        paper_count: papers.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await safeLog(ctx, 'error', `Citation formatting failed: ${errorMessage}`);
      await safeProgress(ctx, 100, 'Citation formatting failed');
      throw error;
    }
  },
};

export * from './general';
