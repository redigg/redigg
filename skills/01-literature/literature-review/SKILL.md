---
name: literature-review
description: Generate structured literature reviews on a specific topic. Use this tool when you need a comprehensive summary of the current research landscape, including executive summaries, key trends, and future directions.
---

# Literature Review Generator

This macro-skill orchestrates the `paper_search` tool and the LLM to automatically generate a complete literature review. 

## Process
1. It queries multiple academic sources for papers related to the provided `topic`.
2. It aggregates the paper abstracts and metadata.
3. It asks the LLM to write a structured review including:
   - Executive Summary
   - Key Themes and Trends
   - Summaries of Individual Papers
   - Identified Gaps / Future Directions
4. It saves the resulting Markdown review to a local file automatically.

## Parameters
- `topic`: The core research question or subject.
- `max_papers`: (Optional) The maximum number of papers to fetch. Default is 3.

**Example Input:**
```json
{
  "topic": "AI Agents for Software Engineering",
  "max_papers": 5
}
```
