import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { Paper } from './scholar-search';

export class ArxivSearch {
  private readonly BASE_URL = 'http://export.arxiv.org/api/query';
  private readonly parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
  });

  async searchPapers(topic: string, limit: number = 5): Promise<Paper[]> {
    try {
      // ArXiv query format: search_query=all:electron&start=0&max_results=10
      // We clean the topic to be safe for query
      const cleanTopic = topic.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      if (!cleanTopic) return [];

      const query = encodeURIComponent(cleanTopic);
      const url = `${this.BASE_URL}?search_query=all:${query}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;
      
      console.log(`Searching ArXiv for: ${cleanTopic}`);
      const response = await axios.get(url, { timeout: 15000 });
      
      if (!response.data) return [];
      
      const parsed = this.parser.parse(response.data);
      const feed = parsed.feed;
      if (!feed || !feed.entry) return [];
      
      const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
      
      return entries.map((entry: any) => this.transformEntry(entry));
    } catch (error: any) {
      console.error('ArXiv search failed:', error.message);
      return [];
    }
  }

  private transformEntry(entry: any): Paper {
    // Extract authors
    let authors: string[] = [];
    if (entry.author) {
        if (Array.isArray(entry.author)) {
            authors = entry.author.map((a: any) => a.name);
        } else {
            authors = [entry.author.name];
        }
    }

    // Extract year from published date (e.g. 2023-01-01T00:00:00Z)
    const year = entry.published ? new Date(entry.published).getFullYear() : new Date().getFullYear();
    
    // Extract ID (e.g. http://arxiv.org/abs/2301.00001)
    const idUrl = entry.id;
    const id = typeof idUrl === 'string' ? (idUrl.split('/').pop() || idUrl) : 'unknown';

    // Venue detection from comments/journal_ref
    let venue = 'arXiv';
    // Handle potential namespace variations or structure
    const journalRef = entry['arxiv:journal_ref'] || entry['journal_ref'] || '';
    const comment = entry['arxiv:comment'] || entry['comment'] || '';
    const rawVenueInfo = `${typeof journalRef === 'object' ? JSON.stringify(journalRef) : journalRef} ${typeof comment === 'object' ? JSON.stringify(comment) : comment}`;
    
    const topVenues = ['CVPR', 'NeurIPS', 'ICLR', 'ICML', 'ACL', 'EMNLP', 'AAAI', 'IJCAI', 'ECCV', 'ICCV', 'SIGGRAPH', 'Nature', 'Science'];
    const matchedVenue = topVenues.find(v => new RegExp(`\\b${v}\\b`, 'i').test(rawVenueInfo));
    
    if (matchedVenue) {
        const yearMatch = rawVenueInfo.match(/\b(20\d{2})\b/);
        const venueYear = yearMatch ? yearMatch[1] : '';
        venue = `arXiv (Accepted to ${matchedVenue}${venueYear ? ' ' + venueYear : ''})`;
    } else if (typeof journalRef === 'string' && journalRef.trim()) {
        venue = `arXiv (${journalRef.trim()})`;
    }

    return {
      id: `arxiv:${id}`,
      title: entry.title ? String(entry.title).replace(/\n/g, ' ').trim() : 'Untitled',
      authors,
      year,
      venue,
      abstract: entry.summary ? String(entry.summary).replace(/\n/g, ' ').trim() : '',
      url: typeof idUrl === 'string' ? idUrl : '',
      citations: 0, // ArXiv API doesn't provide citations
      references: []
    };
  }
}

export const arxivSearch = new ArxivSearch();
