import { Skill, SkillContext, SkillParams, SkillResult } from '../../../src/skills/types.js';
import { ScholarTool } from './ScholarTool.js';

export default class PaperSearchSkill implements Skill {
  id = 'paper_search';
  name = 'Paper Search';
  description = 'Search for academic papers across multiple sources (ArXiv, Semantic Scholar, OpenAlex) and aggregate the results. Use this tool whenever you need to find literature or academic information.';
  tags = ['research', 'tool', 'search', 'scholar'];

  parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query or research topic' },
      max_results: { type: 'number', description: 'Maximum number of unique aggregated results to return (default: 5)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds for the overall search (best-effort)' },
      timeout_ms: { type: 'number', description: 'Timeout in milliseconds for the overall search (best-effort)' }
    },
    required: ['query']
  };

  async execute(ctx: SkillContext, params: SkillParams): Promise<SkillResult> {
    ctx.log('thinking', `Searching literature for: ${params.query}`);
    const limit = params.max_results || 5;
    const timeoutMs =
      typeof (params as any).timeout_ms === 'number'
        ? (params as any).timeout_ms
        : typeof (params as any).timeout === 'number'
          ? (params as any).timeout
          : undefined;

    try {
      const scholar = new ScholarTool();
      const query = String(params.query || '').trim();
      const perSourceLimit = Math.max(limit * 2, 6);
      const retries = timeoutMs ? 0 : 3;
      const runKey = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

      ctx.log('action', `[ScholarTool] Searching multiple sources for: ${query}`);

      ctx.log('tool_call', 'scholar.search_arxiv', {
        id: `paper_search_${runKey}_arxiv`,
        tool: 'scholar.search_arxiv',
        input: { query, limit: perSourceLimit, retries, timeoutMs },
      });
      ctx.log('tool_call', 'scholar.search_openalex', {
        id: `paper_search_${runKey}_openalex`,
        tool: 'scholar.search_openalex',
        input: { query, limit: perSourceLimit, retries, timeoutMs },
      });
      ctx.log('tool_call', 'scholar.search_semanticscholar', {
        id: `paper_search_${runKey}_semanticscholar`,
        tool: 'scholar.search_semanticscholar',
        input: { query, limit: perSourceLimit, retries, timeoutMs },
      });

      const [arxiv, openalex, semanticscholar] = await Promise.all([
        scholar.searchArxiv(query, perSourceLimit, retries, timeoutMs).catch((e) => {
          ctx.log('tool_result', 'scholar.search_arxiv', {
            id: `paper_search_${runKey}_arxiv`,
            tool: 'scholar.search_arxiv',
            ok: false,
            output: { error: String(e?.message || e) },
          });
          return [];
        }),
        scholar.searchOpenAlex(query, perSourceLimit, retries, timeoutMs).catch((e) => {
          ctx.log('tool_result', 'scholar.search_openalex', {
            id: `paper_search_${runKey}_openalex`,
            tool: 'scholar.search_openalex',
            ok: false,
            output: { error: String(e?.message || e) },
          });
          return [];
        }),
        scholar.searchSemanticScholar(query, perSourceLimit, retries, timeoutMs).catch((e) => {
          ctx.log('tool_result', 'scholar.search_semanticscholar', {
            id: `paper_search_${runKey}_semanticscholar`,
            tool: 'scholar.search_semanticscholar',
            ok: false,
            output: { error: String(e?.message || e) },
          });
          return [];
        }),
      ]);

      ctx.log('tool_result', 'scholar.search_arxiv', {
        id: `paper_search_${runKey}_arxiv`,
        tool: 'scholar.search_arxiv',
        ok: true,
        output: { count: arxiv.length, sample: arxiv.slice(0, 3).map((p) => p.title) },
      });
      ctx.log('tool_result', 'scholar.search_openalex', {
        id: `paper_search_${runKey}_openalex`,
        tool: 'scholar.search_openalex',
        ok: true,
        output: { count: openalex.length, sample: openalex.slice(0, 3).map((p) => p.title) },
      });
      ctx.log('tool_result', 'scholar.search_semanticscholar', {
        id: `paper_search_${runKey}_semanticscholar`,
        tool: 'scholar.search_semanticscholar',
        ok: true,
        output: { count: semanticscholar.length, sample: semanticscholar.slice(0, 3).map((p) => p.title) },
      });

      const combined = [...arxiv, ...openalex, ...semanticscholar];
      ctx.log('tool_call', 'scholar.aggregate', {
        id: `paper_search_${runKey}_aggregate`,
        tool: 'scholar.aggregate',
        input: { rawHits: combined.length, limit },
      });
      const aggregated = scholar.aggregate(query, combined, limit);
      ctx.log('tool_result', 'scholar.aggregate', {
        id: `paper_search_${runKey}_aggregate`,
        tool: 'scholar.aggregate',
        ok: true,
        output: {
          rawHits: combined.length,
          deduped: aggregated.deduped.length,
          returned: aggregated.final.length,
        },
      });

      ctx.log('action', `[ScholarTool] Aggregated ${combined.length} raw hits into ${aggregated.deduped.length} unique papers, returning ${aggregated.final.length}`);

      const results = aggregated.final;
      if (!results || results.length === 0) {
        return {
          success: true,
          result: 'No results found.',
          papers: [],
          breakdown: {
            arxiv: [],
            openalex: [],
            semanticscholar: [],
            rawCount: combined.length,
            uniqueCount: aggregated.deduped.length,
          }
        };
      }

      const formatted = results.map((r: any) =>
        `Title: ${r.title}\nAuthors: ${r.authors.join(', ')}\nYear: ${r.year}\nSource: ${r.source}\nURL: ${r.url}\nPDF: ${r.pdfUrl}\nCitations: ${r.citationCount || 0}\nSummary: ${r.summary}`
      ).join('\n\n---\n\n');

      return {
        success: true,
        result: formatted,
        papers: results,
        breakdown: {
          arxiv,
          openalex,
          semanticscholar,
          rawCount: combined.length,
          uniqueCount: aggregated.deduped.length,
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
