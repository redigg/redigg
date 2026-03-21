import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export type PaperSource = 'arxiv' | 'openalex' | 'semanticscholar';

export interface Paper {
  title: string;
  authors: string[];
  year: number;
  summary: string;
  url?: string;
  pdfUrl?: string;
  journal?: string;
  source?: PaperSource;
  citationCount?: number;
  doi?: string;
  externalIds?: Record<string, string>;
  relevanceScore?: number;
}

export interface ScholarCacheOptions {
  /** Enable disk caching of search results */
  enabled: boolean;
  /** Cache directory path (default: workspace/.cache/scholar) */
  cacheDir?: string;
  /** TTL in milliseconds (default: 24 hours) */
  ttlMs?: number;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

export class ScholarTool {
  private parser: XMLParser;
  private readonly openAlexApiKey = process.env.OPENALEX_API_KEY?.trim();
  private readonly openAlexEmail = process.env.OPENALEX_EMAIL?.trim();
  private readonly semanticScholarApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  private readonly shouldDelay = !(process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');
  private readonly cacheOptions: ScholarCacheOptions;
  private readonly cacheDir: string;
  private readonly cacheTtlMs: number;

  constructor(cacheOptions?: ScholarCacheOptions) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    this.cacheOptions = cacheOptions || { enabled: false };
    this.cacheDir = this.cacheOptions.cacheDir || path.join(process.cwd(), 'workspace', '.cache', 'scholar');
    this.cacheTtlMs = this.cacheOptions.ttlMs ?? 24 * 60 * 60 * 1000; // 24h default
  }

  // ─── Cache helpers ──────────────────────────────────────────────
  private cacheKey(prefix: string, ...parts: string[]): string {
    const hash = crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
    return `${prefix}_${hash}.json`;
  }

  private readCache<T>(key: string): T | null {
    if (!this.cacheOptions.enabled) return null;
    try {
      const filePath = path.join(this.cacheDir, key);
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf8');
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.timestamp > this.cacheTtlMs) {
        // Expired — delete and return null
        fs.unlinkSync(filePath);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }

  private writeCache<T>(key: string, data: T): void {
    if (!this.cacheOptions.enabled) return;
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      const entry: CacheEntry<T> = { timestamp: Date.now(), data };
      fs.writeFileSync(path.join(this.cacheDir, key), JSON.stringify(entry), 'utf8');
    } catch {
      // Cache write failure is non-critical
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3,
    timeoutMs?: number
  ): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        if (i > 0 && this.shouldDelay) {
          // Exponential backoff: 2, 4, 8 seconds
          const delay = Math.pow(2, i) * 1000;
          console.log(`[ScholarTool] Rate limited or failed, retrying in ${delay}ms... (Attempt ${i}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const controller = timeoutMs ? new AbortController() : null;
        const timeout = timeoutMs
          ? setTimeout(() => {
              controller?.abort();
            }, timeoutMs)
          : null;

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller?.signal ?? options.signal,
          });
        
          if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter && this.shouldDelay) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds)) {
              await new Promise(resolve => setTimeout(resolve, seconds * 1000));
              // Note: This counts as one retry attempt but we use the requested delay
            }
          }
          if (i === maxRetries) return response;
          continue; // Try again
          }

          if (response.status >= 500) {
          if (i === maxRetries) return response;
          continue; // Try again on server errors
          }

          return response;
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      } catch (error: any) {
        if (timeoutMs && (error?.name === 'AbortError' || String(error).toLowerCase().includes('abort'))) {
          throw error;
        }
        lastError = error;
        if (i === maxRetries) throw error;
      }
    }
    throw lastError || new Error('Fetch failed after retries');
  }

  async searchPapers(topic: string, limit: number = 5, options?: { timeoutMs?: number }): Promise<Paper[]> {
    if (!topic || typeof topic !== 'string') {
        console.warn('[ScholarTool] Search called with empty or invalid topic');
        return [];
    }

    console.log(`[ScholarTool] Searching multiple sources for: ${topic}`);

    // Check cache first
    const key = this.cacheKey('search', topic, String(limit));
    const cached = this.readCache<Paper[]>(key);
    if (cached) {
      console.log(`[ScholarTool] Cache hit for: ${topic} (${cached.length} papers)`);
      return cached;
    }

    try {
      const perSourceLimit = Math.max(limit * 2, 6);
      const timeoutMs = options?.timeoutMs;
      const retries = timeoutMs ? 0 : 3;
      const results = await Promise.allSettled([
        this.searchArxiv(topic, perSourceLimit, retries, timeoutMs),
        this.searchOpenAlex(topic, perSourceLimit, retries, timeoutMs),
        this.searchSemanticScholar(topic, perSourceLimit, retries, timeoutMs)
      ]);

      const papers = results.flatMap((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }

        const source = ['arXiv', 'OpenAlex', 'Semantic Scholar'][index] || 'unknown';
        console.warn(`[ScholarTool] ${source} search failed:`, result.reason);
        return [];
      });

      const deduped = this.dedupeAndMerge(papers);
      const ranked = this.rankPapers(deduped, topic);
      const finalPapers = ranked.slice(0, limit);

      console.log(
        `[ScholarTool] Aggregated ${papers.length} raw hits into ${deduped.length} unique papers, returning ${finalPapers.length}`
      );

      // Write to cache
      this.writeCache(key, finalPapers);

      return finalPapers;
    } catch (error) {
      console.error('[ScholarTool] Search failed:', error);
      return [];
    }
  }

  public aggregate(topic: string, papers: Paper[], limit: number): { deduped: Paper[]; ranked: Paper[]; final: Paper[] } {
    const deduped = this.dedupeAndMerge(papers);
    const ranked = this.rankPapers(deduped, topic);
    const final = ranked.slice(0, limit);
    return { deduped, ranked, final };
  }

  public async searchArxiv(topic: string, limit: number, retries: number, timeoutMs?: number): Promise<Paper[]> {
    const baseUrl = 'http://export.arxiv.org/api/query';
    const searchUrl = `${baseUrl}?search_query=all:${encodeURIComponent(topic)}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;
    
    // ArXiv can be strict with rate limiting, use fetchWithRetry
    const response = await this.fetchWithRetry(
      searchUrl,
      {
      headers: {
        'User-Agent': 'redigg-scholar-tool/0.1'
      }
      },
      retries,
      timeoutMs
    );
    
    if (response.status === 429) {
      console.warn('[ScholarTool] arXiv rate limited after retries, skipping source');
      return [];
    }

    if (!response.ok) {
      throw new Error(`arXiv API failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const xmlData = decoder.decode(buffer);
    const result = this.parser.parse(xmlData);

    if (!result.feed || !result.feed.entry) {
      return [];
    }

    const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];

    return entries.map((entry: any) => {
      const authors = Array.isArray(entry.author)
        ? entry.author.map((author: any) => author.name)
        : entry.author
          ? [entry.author.name]
          : [];

      const published = new Date(entry.published);
      const year = Number.isNaN(published.getFullYear()) ? 0 : published.getFullYear();
      const idUrl = entry.id;
      const pdfUrl = Array.isArray(entry.link)
        ? entry.link.find((link: any) => link['@_title'] === 'pdf')?.['@_href']
        : undefined;
      const arxivId = this.extractArxivId(idUrl || pdfUrl);

      return {
        title: typeof entry.title === 'string' ? entry.title.replace(/\n/g, ' ').trim() : 'Untitled',
        authors,
        year,
        summary: typeof entry.summary === 'string' ? entry.summary.replace(/\n/g, ' ').trim() : 'No summary',
        url: idUrl,
        pdfUrl,
        journal: 'arXiv',
        source: 'arxiv',
        externalIds: arxivId ? { ArXiv: arxivId } : undefined
      } satisfies Paper;
    });
  }

  public async searchOpenAlex(topic: string, limit: number, retries: number, timeoutMs?: number): Promise<Paper[]> {
    const params = new URLSearchParams({
      search: topic,
      'per-page': String(limit),
      select: 'id,display_name,publication_year,authorships,abstract_inverted_index,primary_location,best_oa_location,open_access,cited_by_count,doi'
    });

    if (this.openAlexEmail) {
      params.set('mailto', this.openAlexEmail);
    }

    if (this.openAlexApiKey) {
      params.set('api_key', this.openAlexApiKey);
    }

    const response = await this.fetchWithRetry(
      `https://api.openalex.org/works?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'redigg-scholar-tool/0.1'
        }
      },
      retries,
      timeoutMs
    );

    if (response.status === 429) {
      console.warn('[ScholarTool] OpenAlex rate limited after retries, skipping source');
      return [];
    }

    if (!response.ok) {
      throw new Error(`OpenAlex API failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];

    return results.map((item: any) => {
      const title = typeof item.display_name === 'string' ? item.display_name.trim() : 'Untitled';
      const authors = Array.isArray(item.authorships)
        ? item.authorships
            .map((authorship: any) => authorship?.author?.display_name)
            .filter(Boolean)
        : [];
      const abstract = this.reconstructOpenAlexAbstract(item.abstract_inverted_index);
      const doi = this.normalizeDoi(item.doi);
      const landingPage = item.primary_location?.landing_page_url || item.best_oa_location?.landing_page_url || item.id;
      const pdfUrl = item.best_oa_location?.pdf_url || item.primary_location?.pdf_url || undefined;
      const venue = item.primary_location?.source?.display_name || item.best_oa_location?.source?.display_name || 'OpenAlex';

      return {
        title,
        authors,
        year: Number(item.publication_year) || 0,
        summary: abstract || 'No summary',
        url: landingPage,
        pdfUrl,
        journal: venue,
        source: 'openalex',
        citationCount: Number(item.cited_by_count) || 0,
        doi,
        externalIds: doi ? { DOI: doi } : undefined
      } satisfies Paper;
    });
  }

  public async searchSemanticScholar(topic: string, limit: number, retries: number, timeoutMs?: number): Promise<Paper[]> {
    if (!this.semanticScholarApiKey) {
      return [];
    }

    const params = new URLSearchParams({
      query: topic,
      limit: String(limit),
      fields: 'title,abstract,year,authors,url,externalIds,citationCount,publicationVenue,openAccessPdf'
    });

    const response = await this.fetchWithRetry(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`,
      {
        headers: {
          'x-api-key': this.semanticScholarApiKey,
          'User-Agent': 'redigg-scholar-tool/0.1'
        }
      },
      retries,
      timeoutMs
    );

    if (response.status === 429) {
      console.warn('[ScholarTool] Semantic Scholar rate limited after retries, skipping source');
      return [];
    }

    if (!response.ok) {
      throw new Error(`Semantic Scholar API failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload.data) ? payload.data : [];

    return results.map((item: any) => {
      const doi = this.normalizeDoi(item.externalIds?.DOI);
      const arxivId = item.externalIds?.ArXiv;
      const externalIds: Record<string, string> = {};
      if (doi) externalIds.DOI = doi;
      if (arxivId) externalIds.ArXiv = arxivId;

      return {
        title: typeof item.title === 'string' ? item.title.trim() : 'Untitled',
        authors: Array.isArray(item.authors) ? item.authors.map((author: any) => author.name).filter(Boolean) : [],
        year: Number(item.year) || 0,
        summary: typeof item.abstract === 'string' && item.abstract.trim() ? item.abstract.trim() : 'No summary',
        url: item.url || undefined,
        pdfUrl: item.openAccessPdf?.url || undefined,
        journal: item.publicationVenue?.name || 'Semantic Scholar',
        source: 'semanticscholar',
        citationCount: Number(item.citationCount) || 0,
        doi,
        externalIds: Object.keys(externalIds).length > 0 ? externalIds : undefined
      } satisfies Paper;
    });
  }

  /**
   * Snowball expansion: given a set of seed papers, fetch their references and
   * citers from Semantic Scholar and OpenAlex, returning new papers not already
   * in the seed set.
   */
  async expandCitationGraph(
    seedPapers: Paper[],
    options: { maxSeeds?: number; perPaperLimit?: number } = {}
  ): Promise<Paper[]> {
    const maxSeeds = options.maxSeeds ?? 5;
    const perPaperLimit = options.perPaperLimit ?? 3;

    // Check cache — use seed paper titles as cache key
    const seedKeys = seedPapers.map((p) => p.title).sort().join('|');
    const key = this.cacheKey('cite', seedKeys, String(maxSeeds), String(perPaperLimit));
    const cached = this.readCache<Paper[]>(key);
    if (cached) {
      console.log(`[ScholarTool] Cache hit for citation graph (${cached.length} papers)`);
      return cached;
    }

    const existingKeys = new Set(seedPapers.map((p) => this.buildPaperKey(p)));

    // Pick the most-cited seeds to expand from
    const sortedSeeds = [...seedPapers]
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
      .slice(0, maxSeeds);

    const allNewPapers: Paper[] = [];

    for (const seed of sortedSeeds) {
      if (this.shouldDelay) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const expanded = await this.fetchCitationNeighbors(seed, perPaperLimit);
      for (const paper of expanded) {
        const pkey = this.buildPaperKey(paper);
        if (!existingKeys.has(pkey)) {
          existingKeys.add(pkey);
          allNewPapers.push(paper);
        }
      }
    }

    const deduped = this.dedupeAndMerge(allNewPapers);
    console.log(
      `[ScholarTool] Citation graph expanded ${sortedSeeds.length} seeds → ${deduped.length} new papers`
    );

    // Write to cache
    this.writeCache(key, deduped);

    return deduped;
  }

  /**
   * Fetch references + citations for a single paper via Semantic Scholar
   * (preferred) or OpenAlex.
   */
  private async fetchCitationNeighbors(paper: Paper, limit: number): Promise<Paper[]> {
    const results: Paper[] = [];

    // Try Semantic Scholar first (richer citation graph)
    const s2Id = this.resolveSemanticScholarId(paper);
    if (s2Id) {
      const [refs, citers] = await Promise.allSettled([
        this.fetchS2References(s2Id, limit),
        this.fetchS2Citations(s2Id, limit)
      ]);
      if (refs.status === 'fulfilled') results.push(...refs.value);
      if (citers.status === 'fulfilled') results.push(...citers.value);
    }

    // Also try OpenAlex if we have a DOI
    if (paper.doi) {
      try {
        const oaRefs = await this.fetchOpenAlexCitations(paper.doi, limit);
        results.push(...oaRefs);
      } catch { /* non-critical */ }
    }

    return results;
  }

  private resolveSemanticScholarId(paper: Paper): string | undefined {
    if (paper.externalIds?.ArXiv) return `ArXiv:${paper.externalIds.ArXiv}`;
    if (paper.doi) return `DOI:${paper.doi}`;
    const arxivId = this.extractArxivId(paper.url || paper.pdfUrl);
    if (arxivId) return `ArXiv:${arxivId}`;
    return undefined;
  }

  private async fetchS2References(paperId: string, limit: number): Promise<Paper[]> {
    const fields = 'title,abstract,year,authors,url,externalIds,citationCount,publicationVenue';
    const params = new URLSearchParams({ fields, limit: String(limit) });
    const headers: Record<string, string> = { 'User-Agent': 'redigg-scholar-tool/0.1' };
    if (this.semanticScholarApiKey) headers['x-api-key'] = this.semanticScholarApiKey;

    try {
      const response = await this.fetchWithRetry(
        `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}/references?${params}`,
        { headers },
        1
      );
      if (!response.ok) return [];
      const payload = await response.json();
      const data = Array.isArray(payload.data) ? payload.data : [];
      return data
        .filter((item: any) => item.citedPaper?.title)
        .map((item: any) => this.parseS2Paper(item.citedPaper));
    } catch { return []; }
  }

  private async fetchS2Citations(paperId: string, limit: number): Promise<Paper[]> {
    const fields = 'title,abstract,year,authors,url,externalIds,citationCount,publicationVenue';
    const params = new URLSearchParams({ fields, limit: String(limit) });
    const headers: Record<string, string> = { 'User-Agent': 'redigg-scholar-tool/0.1' };
    if (this.semanticScholarApiKey) headers['x-api-key'] = this.semanticScholarApiKey;

    try {
      const response = await this.fetchWithRetry(
        `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}/citations?${params}`,
        { headers },
        1
      );
      if (!response.ok) return [];
      const payload = await response.json();
      const data = Array.isArray(payload.data) ? payload.data : [];
      return data
        .filter((item: any) => item.citingPaper?.title)
        .map((item: any) => this.parseS2Paper(item.citingPaper));
    } catch { return []; }
  }

  private parseS2Paper(item: any): Paper {
    const doi = this.normalizeDoi(item.externalIds?.DOI);
    const arxivId = item.externalIds?.ArXiv;
    const externalIds: Record<string, string> = {};
    if (doi) externalIds.DOI = doi;
    if (arxivId) externalIds.ArXiv = arxivId;

    return {
      title: typeof item.title === 'string' ? item.title.trim() : 'Untitled',
      authors: Array.isArray(item.authors) ? item.authors.map((a: any) => a.name).filter(Boolean) : [],
      year: Number(item.year) || 0,
      summary: typeof item.abstract === 'string' && item.abstract.trim() ? item.abstract.trim() : 'No summary',
      url: item.url || undefined,
      journal: item.publicationVenue?.name || 'Unknown venue',
      source: 'semanticscholar',
      citationCount: Number(item.citationCount) || 0,
      doi,
      externalIds: Object.keys(externalIds).length > 0 ? externalIds : undefined
    };
  }

  private async fetchOpenAlexCitations(doi: string, limit: number): Promise<Paper[]> {
    const params = new URLSearchParams({
      filter: `cites:https://doi.org/${doi}`,
      'per-page': String(limit),
      select: 'id,display_name,publication_year,authorships,abstract_inverted_index,primary_location,cited_by_count,doi'
    });
    if (this.openAlexEmail) params.set('mailto', this.openAlexEmail);

    try {
      const response = await this.fetchWithRetry(
        `https://api.openalex.org/works?${params}`,
        { headers: { 'User-Agent': 'redigg-scholar-tool/0.1' } },
        1
      );
      if (!response.ok) return [];
      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results : [];
      return results.map((item: any) => {
        const paperDoi = this.normalizeDoi(item.doi);
        return {
          title: typeof item.display_name === 'string' ? item.display_name.trim() : 'Untitled',
          authors: Array.isArray(item.authorships)
            ? item.authorships.map((a: any) => a?.author?.display_name).filter(Boolean)
            : [],
          year: Number(item.publication_year) || 0,
          summary: this.reconstructOpenAlexAbstract(item.abstract_inverted_index) || 'No summary',
          url: item.primary_location?.landing_page_url || item.id,
          journal: item.primary_location?.source?.display_name || 'OpenAlex',
          source: 'openalex',
          citationCount: Number(item.cited_by_count) || 0,
          doi: paperDoi,
          externalIds: paperDoi ? { DOI: paperDoi } : undefined
        } satisfies Paper;
      });
    } catch { return []; }
  }

  private reconstructOpenAlexAbstract(index?: Record<string, number[]>): string {
    if (!index || typeof index !== 'object') {
      return '';
    }

    const positions = Object.entries(index)
      .flatMap(([token, slots]) => Array.isArray(slots) ? slots.map((slot) => [slot, token] as const) : [])
      .sort((a, b) => a[0] - b[0]);

    return positions.map(([, token]) => token).join(' ').trim();
  }

  private dedupeAndMerge(papers: Paper[]): Paper[] {
    const mergedById = new Map<string, Paper>();

    for (const paper of papers) {
      const key = this.buildPaperKey(paper);
      const existing = mergedById.get(key);

      if (!existing) {
        mergedById.set(key, { ...paper });
        continue;
      }

      mergedById.set(key, this.mergePaper(existing, paper));
    }

    const mergedByTitle = new Map<string, Paper>();
    for (const paper of mergedById.values()) {
      const normalizedTitle = this.normalizeTitle(paper.title);
      const titleKey = paper.year ? `${normalizedTitle}:${paper.year}` : normalizedTitle;
      const existing = mergedByTitle.get(titleKey);
      if (!existing) {
        mergedByTitle.set(titleKey, paper);
        continue;
      }

      const yearsComparable = !existing.year || !paper.year || Math.abs(existing.year - paper.year) <= 1;
      if (!yearsComparable) {
        const fallbackKey = `${normalizedTitle}:${paper.year || 'unknown'}:${paper.source || 'unknown'}`;
        mergedByTitle.set(fallbackKey, paper);
        continue;
      }

      mergedByTitle.set(titleKey, this.mergePaper(existing, paper));
    }

    return Array.from(mergedByTitle.values());
  }

  private buildPaperKey(paper: Paper): string {
    const doi = this.normalizeDoi(paper.doi || paper.externalIds?.DOI);
    if (doi) return `doi:${doi}`;

    const arxivId = paper.externalIds?.ArXiv || this.extractArxivId(paper.url || paper.pdfUrl);
    if (arxivId) return `arxiv:${arxivId.toLowerCase()}`;

    return `title:${this.normalizeTitle(paper.title)}`;
  }

  private mergePaper(primary: Paper, secondary: Paper): Paper {
    const primaryScore = this.paperRichness(primary);
    const secondaryScore = this.paperRichness(secondary);
    const preferred = secondaryScore > primaryScore ? secondary : primary;
    const fallback = preferred === primary ? secondary : primary;

    const authors = Array.from(new Set([...(preferred.authors || []), ...(fallback.authors || [])]));
    const externalIds = { ...(fallback.externalIds || {}), ...(preferred.externalIds || {}) };

    return {
      ...fallback,
      ...preferred,
      authors,
      summary: this.pickLonger(preferred.summary, fallback.summary, 'No summary'),
      url: preferred.url || fallback.url,
      pdfUrl: preferred.pdfUrl || fallback.pdfUrl,
      journal: preferred.journal || fallback.journal,
      year: preferred.year || fallback.year,
      citationCount: Math.max(preferred.citationCount || 0, fallback.citationCount || 0),
      doi: this.normalizeDoi(preferred.doi || fallback.doi),
      externalIds: Object.keys(externalIds).length > 0 ? externalIds : undefined
    };
  }

  private paperRichness(paper: Paper): number {
    return (paper.summary && paper.summary !== 'No summary' ? 4 : 0)
      + (paper.citationCount ? Math.min(Math.log10(paper.citationCount + 1), 4) : 0)
      + (paper.pdfUrl ? 2 : 0)
      + (paper.url ? 1 : 0)
      + (paper.journal ? 1 : 0)
      + (paper.doi ? 1 : 0)
      + this.sourceBonus(paper.source);
  }

  private rankPapers(papers: Paper[], topic: string): Paper[] {
    const tokens = this.tokenize(topic || '');
    const anchorTokens = tokens.slice(0, Math.min(2, tokens.length));
    const phrase = (topic || '').trim().toLowerCase();

    return [...papers]
      .map((paper) => {
        const title = (paper.title || '').toLowerCase();
        const summary = (paper.summary || '').toLowerCase();
        const combined = `${title} ${summary}`;
        const titleMatches = tokens.reduce((count, token) => count + this.countOccurrences(title, token), 0);
        const summaryMatches = tokens.reduce((count, token) => count + this.countOccurrences(summary, token), 0);
        const uniqueTitleMatches = tokens.filter((token) => title.includes(token)).length;
        const uniqueCombinedMatches = tokens.filter((token) => combined.includes(token)).length;
        const anchorMatches = anchorTokens.filter((token) => combined.includes(token)).length;
        const coverageScore = tokens.length > 0 ? (uniqueCombinedMatches / tokens.length) * 10 : 0;
        const phraseBonus = phrase && combined.includes(phrase) ? 8 : 0;
        const citationScore = Math.min(Math.log10((paper.citationCount || 0) + 1), 4);
        const recencyScore = paper.year ? Math.max(paper.year - 2018, 0) * 0.15 : 0;
        const abstractBonus = paper.summary && paper.summary !== 'No summary' ? 1.2 : 0;
        const lowCoveragePenalty = uniqueCombinedMatches <= 1 ? -6 : uniqueCombinedMatches === 2 ? -2 : 0;
        const anchorPenalty = anchorTokens.length > 0
          ? (anchorMatches === 0 ? -8 : anchorMatches === 1 ? -2 : 0)
          : 0;
        const score = (uniqueTitleMatches * 6)
          + coverageScore
          + (titleMatches * 1.2)
          + (summaryMatches * 0.6)
          + phraseBonus
          + citationScore
          + recencyScore
          + abstractBonus
          + lowCoveragePenalty
          + anchorPenalty
          + this.sourceBonus(paper.source);

        return {
          ...paper,
          relevanceScore: Number(score.toFixed(3))
        };
      })
      .sort((a, b) => {
        const diff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
        if (diff !== 0) return diff;
        return (b.citationCount || 0) - (a.citationCount || 0);
      });
  }

  private tokenize(topic: string): string[] {
    if (!topic || typeof topic !== 'string') {
        return [];
    }
    const stopwords = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'using', 'study']);
    return Array.from(new Set(
      topic
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .map((token) => token.endsWith('s') && token.length > 4 ? token.slice(0, -1) : token)
        .filter((token) => token.length > 2 && !stopwords.has(token))
    ));
  }

  private countOccurrences(content: string, token: string): number {
    if (!content || !token) return 0;
    return content.split(token).length - 1;
  }

  private sourceBonus(source?: PaperSource): number {
    switch (source) {
      case 'openalex':
        return 1.4;
      case 'semanticscholar':
        return 1.1;
      case 'arxiv':
        return 0.8;
      default:
        return 0;
    }
  }

  private pickLonger(preferred?: string, fallback?: string, defaultValue: string = ''): string {
    const candidateA = preferred?.trim() || '';
    const candidateB = fallback?.trim() || '';
    if (candidateA.length >= candidateB.length) {
      return candidateA || candidateB || defaultValue;
    }

    return candidateB || candidateA || defaultValue;
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]+/g, '')
      .trim();
  }

  private normalizeDoi(doi?: string): string | undefined {
    if (!doi || typeof doi !== 'string') {
      return undefined;
    }

    return doi
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
      .trim()
      .toLowerCase() || undefined;
  }

  private extractArxivId(value?: string): string | undefined {
    if (!value) return undefined;
    const match = value.match(/arxiv\.org\/(?:abs|pdf)\/([^?#/]+)|\/([^/?#]+)$/i);
    return (match?.[1] || match?.[2] || '').replace(/\.pdf$/i, '') || undefined;
  }
}
