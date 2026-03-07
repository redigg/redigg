import axios from 'axios';
import { getConfig } from '../config';

export async function webSearch(query: string, maxResults: number = 5): Promise<string> {
  const tavilyKey = getConfig('tavily.apiKey') || process.env.TAVILY_API_KEY;
  
  if (tavilyKey) {
    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: maxResults
      });
      
      const results = response.data.results.map((r: any) => `
Title: ${r.title}
URL: ${r.url}
Content: ${r.content}
`).join('\n---\n');

      return `Tavily Search Results for "${query}":\n${results}\n\nAnswer: ${response.data.answer || ''}`;
    } catch (error: any) {
      console.error('Tavily search failed:', error.message);
      return `Search failed: ${error.message}`;
    }
  }

  // Fallback to Arxiv if no web search key (or just return instruction)
  return "Web search is not configured. Please set TAVILY_API_KEY using 'redigg config set tavily.apiKey <key>' to enable web search.";
}
