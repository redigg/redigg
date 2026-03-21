---
name: paper-summarizer
description: Generate a concise, structured summary of a single paper given its full text or abstract. Useful for digesting long papers quickly.
---

# Paper Summarizer

This skill takes the raw text of a paper (usually extracted via `paper-reader`) and uses an LLM to generate a highly structured, scannable summary.

## Output Format
The generated summary will always contain these core sections:
- **Core Contribution**
- **Methodology**
- **Key Findings**
- **Limitations**

## Parameters
- `text`: The full text or abstract of the paper to summarize.
- `focus`: (Optional) A specific aspect to focus the summary on, such as "methodology", "limitations", or "datasets used".

**Example Input:**
```json
{
  "text": "Abstract: We introduce a novel transformer architecture...",
  "focus": "Attention mechanism efficiency"
}
```
