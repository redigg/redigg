import axios, { AxiosError, AxiosInstance } from 'axios';
import { getConfig } from '../config';

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  abstract: string;
  url: string;
  citations: number;
  references: string[];
}

export class ScholarSearch {
  private readonly BASE_URL = 'https://api.semanticscholar.org/graph/v1';
  private readonly TIMEOUT = this.getNumberConfig('semanticScholar.timeoutMs', 'SEMANTIC_SCHOLAR_TIMEOUT_MS', 10000);
  private readonly MAX_RETRIES = this.getNumberConfig('semanticScholar.maxRetries', 'SEMANTIC_SCHOLAR_MAX_RETRIES', 3);
  private readonly INITIAL_BACKOFF_MS = this.getNumberConfig(
    'semanticScholar.initialBackoffMs',
    'SEMANTIC_SCHOLAR_INITIAL_BACKOFF_MS',
    3000
  );
  private readonly API_KEY = getConfig('semanticScholar.apiKey', 'SEMANTIC_SCHOLAR_API_KEY');
  private readonly http: AxiosInstance;

  constructor() {
    const headers: Record<string, string> = {};
    if (this.API_KEY) {
      headers['x-api-key'] = this.API_KEY;
    }

    this.http = axios.create({
      baseURL: this.BASE_URL,
      timeout: this.TIMEOUT,
      headers,
    });
  }

  /**
   * 搜索相关论文
   * @param topic 搜索主题
   * @param limit 结果数量限制（默认10篇）
   * @returns 论文列表
   */
  async searchPapers(topic: string, limit: number = 10): Promise<Paper[]> {
    const cleanTopic = topic.trim();
    if (!cleanTopic) return [];

    try {
      console.log(`Searching for papers on topic: ${cleanTopic}`);

      const response = await this.requestWithRetry<{
        data?: any[];
      }>('/paper/search', {
        params: {
          query: cleanTopic,
          limit: limit,
          fields: 'title,authors,year,venue,abstract,url,citationCount,referenceCount'
        },
      }, 'search papers');

      if (!response) return [];

      if (response.data?.data) {
        return response.data.data.map((paper: any) => this.transformPaper(paper));
      }

      return [];
    } catch (error) {
      console.error('Error searching papers:', this.summarizeError(error));
      return [];
    }
  }

  /**
   * 获取论文详细信息
   * @param paperId Semantic Scholar 论文ID
   * @returns 论文详细信息
   */
  async getPaperDetails(paperId: string): Promise<Paper | null> {
    const cleanPaperId = paperId.trim();
    if (!cleanPaperId) return null;

    try {
      const response = await this.requestWithRetry<any>(`/paper/${encodeURIComponent(cleanPaperId)}`, {
        params: {
          fields: 'title,authors,year,venue,abstract,url,citationCount,referenceCount'
        },
      }, 'get paper details');

      if (!response) return null;

      if (response.data) {
        return this.transformPaper(response.data);
      }

      return null;
    } catch (error) {
      console.error(`Error getting paper details for ${cleanPaperId}:`, this.summarizeError(error));
      return null;
    }
  }

  private async requestWithRetry<T>(
    url: string,
    config: { params?: Record<string, unknown> },
    operation: string
  ) {
    let attempt = 0;
    const maxAttempt = Math.max(1, this.MAX_RETRIES + 1);

    while (attempt < maxAttempt) {
      try {
        return await this.http.get<T>(url, config);
      } catch (error) {
        attempt += 1;
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;

        const shouldRetry =
          attempt < maxAttempt &&
          (status === 429 ||
            (status !== undefined && status >= 500) ||
            this.isTransientNetworkError(axiosError.code));

        if (!shouldRetry) {
          throw error;
        }

        const delayMs = this.getRetryDelayMs(axiosError, attempt);
        const statusText = status ? `HTTP ${status}` : 'network timeout/error';
        console.warn(
          `Semantic Scholar ${operation} failed (${statusText}), retry ${attempt}/${maxAttempt - 1} in ${delayMs}ms`
        );
        if (status === 429 && !this.API_KEY) {
             console.warn('Hint: Set SEMANTIC_SCHOLAR_API_KEY to avoid rate limits.');
        }
        await this.sleep(delayMs);
      }
    }

    return null;
  }

  private isTransientNetworkError(code?: string): boolean {
    if (!code) return false;
    return [
      'ECONNABORTED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'EAI_AGAIN',
      'ERR_NETWORK',
    ].includes(code);
  }

  private getRetryDelayMs(error: AxiosError, attempt: number): number {
    const retryAfterHeader = error.response?.headers?.['retry-after'];
    const retryAfter = Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : retryAfterHeader;
    const parsedRetryAfter = this.parseRetryAfterMs(retryAfter);
    if (parsedRetryAfter !== null) return parsedRetryAfter;

    const exponential = this.INITIAL_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1));
    const jitter = Math.floor(Math.random() * 300);
    return exponential + jitter;
  }

  private parseRetryAfterMs(value: unknown): number | null {
    if (typeof value !== 'string' || !value.trim()) return null;

    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
      return Math.min(60000, Math.floor(asNumber * 1000));
    }

    const asDate = Date.parse(value);
    if (Number.isNaN(asDate)) return null;
    const delta = asDate - Date.now();
    if (delta <= 0) return null;
    return Math.min(60000, delta);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private summarizeError(error: unknown): string {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const code = axiosError.code;
    const message = axiosError.message || String(error);
    const detail = status ? `HTTP ${status}` : code || 'unknown-error';
    return `${detail}: ${message}`;
  }

  private getNumberConfig(key: string, envKey: string, fallback: number): number {
    const raw = getConfig(key, envKey);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  /**
   * 转换 API 响应格式
   */
  private transformPaper(data: any): Paper {
    return {
      id: data.paperId,
      title: data.title,
      authors: data.authors?.map((a: any) => a.name) || [],
      year: data.year,
      venue: data.venue,
      abstract: data.abstract || '',
      url: data.url || '',
      citations: data.citationCount || 0,
      references: [] // 需要额外请求获取引用信息
    };
  }

  /**
   * 根据标题搜索论文（精确匹配）
   */
  async searchByTitle(title: string): Promise<Paper[]> {
    return this.searchPapers(title, 3);
  }

  /**
   * 构建论文引用字符串
   */
  formatCitation(paper: Paper): string {
    const authors = paper.authors.length > 3 
      ? `${paper.authors[0]} et al.` 
      : paper.authors.join(', ');
    
    return `${authors} (${paper.year}). ${paper.title}. ${paper.venue}`;
  }

  /**
   * 格式化论文信息为 Markdown 格式
   */
  formatPaperMarkdown(paper: Paper): string {
    const authors = paper.authors.length > 3 
      ? `${paper.authors[0]} et al.` 
      : paper.authors.join(', ');
    
    let markdown = `## ${paper.title}\n\n` +
      `**Authors:** ${authors}\n\n` +
      `**Year:** ${paper.year} | **Venue:** ${paper.venue} | **Citations:** ${paper.citations}\n\n` +
      `**Abstract:** ${paper.abstract}\n\n`;
    
    if (paper.url) {
      markdown += `[Full Paper](${paper.url})\n\n`;
    }
    
    return markdown;
  }
}

// 单例实例
export const scholarSearch = new ScholarSearch();
