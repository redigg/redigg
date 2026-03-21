---
name: paper-search
description: Search for academic papers across ArXiv, Semantic Scholar, and OpenAlex. Use this tool to find literature, retrieve citations, or get abstracts for a research topic.
---

# Paper Search

This skill performs an aggregated search across multiple leading academic databases:
- **ArXiv** (Fast, recent pre-prints)
- **Semantic Scholar** (High-quality citation graphs and summaries)
- **OpenAlex** (Massive open catalog)

It automatically queries all sources in parallel, deduplicates the results based on title similarity, and returns a unified list of papers.

## Parameters
- `query`: The search query, keywords, or research topic.
- `max_results`: (Optional) The maximum number of unique aggregated results to return. Defaults to 5.

**Example Input:**
```json
{
  "query": "Chain of Thought Prompting in Large Language Models",
  "max_results": 10
}
```
