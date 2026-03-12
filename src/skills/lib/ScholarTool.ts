import { XMLParser } from 'fast-xml-parser';

export interface Paper {
  title: string;
  authors: string[];
  year: number;
  summary: string;
  url?: string;
  pdfUrl?: string;
  journal?: string;
}

export class ScholarTool {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  async searchPapers(topic: string, limit: number = 5): Promise<Paper[]> {
    console.log(`[ScholarTool] Searching arXiv for: ${topic}`);
    
    try {
      // arXiv API endpoint
      const baseUrl = 'http://export.arxiv.org/api/query';
      const searchUrl = `${baseUrl}?search_query=all:${encodeURIComponent(topic)}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`arXiv API failed: ${response.statusText}`);
      }

      // Ensure we treat response as UTF-8
      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const xmlData = decoder.decode(buffer);
      
      const result = this.parser.parse(xmlData);

      if (!result.feed || !result.feed.entry) {
        console.warn('[ScholarTool] No results found');
        return [];
      }

      // Handle single result vs array of results
      let entries: any[] = [];
      if (Array.isArray(result.feed.entry)) {
        entries = result.feed.entry;
      } else {
        entries = [result.feed.entry];
      }

      return entries.map((entry: any) => {
        // Extract authors
        let authors: string[] = [];
        if (Array.isArray(entry.author)) {
          authors = entry.author.map((a: any) => a.name);
        } else if (entry.author) {
          authors = [entry.author.name];
        }

        // Extract year
        const published = new Date(entry.published);
        const year = published.getFullYear();

        // Extract URLs
        const idUrl = entry.id;
        let pdfUrl = '';
        if (Array.isArray(entry.link)) {
            const pdfLink = entry.link.find((l: any) => l['@_title'] === 'pdf');
            if (pdfLink) pdfUrl = pdfLink['@_href'];
        }

        return {
          title: typeof entry.title === 'string' ? entry.title.replace(/\n/g, ' ').trim() : 'Untitled',
          authors,
          year,
          summary: typeof entry.summary === 'string' ? entry.summary.replace(/\n/g, ' ').trim() : 'No summary',
          url: idUrl,
          pdfUrl,
          journal: 'arXiv'
        };
      });

    } catch (error) {
      console.error('[ScholarTool] Search failed:', error);
      return [];
    }
  }
}

