---
name: paper-idea-generator
description: Generate novel, actionable paper ideas from arXiv papers and LLM analysis. Automatically fetches papers, identifies research gaps, and produces detailed research proposals with methodology and evaluation metrics.
---

# Paper Idea Generator

This skill automatically generates novel, actionable paper ideas by:
1. Fetching relevant papers from arXiv
2. Identifying research gaps
3. Using LLM to generate detailed research proposals

## Output Format
Returns a structured Markdown document containing the requested number of paper ideas. Each idea includes:
- **Title** (English and Chinese)
- **Research Questions** (2-3 specific questions)
- **Core Method** (Technical approach)
- **Evaluation** (Difficulty, Novelty, Feasibility, Timeline, Score)
- **Related Papers** (from arXiv)

## Parameters
- `topic`: The research topic or domain (e.g., "LLM Agents", "RAG Enhancement").
- `num_ideas`: (Optional) Number of ideas to generate. Defaults to 5.
- `max_papers`: (Optional) Maximum papers to fetch from arXiv. Defaults to 20.

**Example Input:**
```json
{
  "topic": "LLM Agents",
  "num_ideas": 5,
  "max_papers": 20
}
```

**Example Output:**
```json
{
  "success": true,
  "ideas": [
    {
      "title": "Hierarchical Memory-Constrained Task Decomposition for Long-Horizon LLM Agents",
      "title_zh": "面向长周期大语言模型智能体的分层记忆约束任务分解方法",
      "research_gap": "hierarchical",
      "research_questions": ["问题1", "问题2"],
      "core_method": "核心方法描述",
      "score": 85,
      "related_papers": ["Paper 1", "Paper 2"]
    }
  ],
  "papers_found": 20
}
```

## Dependencies
- Requires internet access to fetch papers from arXiv API
- Uses configured LLM for idea generation