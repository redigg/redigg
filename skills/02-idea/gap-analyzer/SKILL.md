---
name: gap-analyzer
description: Analyze a set of paper abstracts or literature summaries to identify missing links, contradictions, or unexplored areas in current research.
---

# Research Gap Analyzer

This skill acts as an expert reviewer. It reads through provided literature summaries and systematically identifies critical research gaps that could form the basis of a new paper or experiment.

## Output Format
The skill outputs a structured Markdown document containing 3-5 gaps, each detailing:
- Gap Title
- Description (What is missing)
- Evidence (Which papers suggest this gap)
- Potential Impact (Why solving it matters)

## Parameters
- `literature_summary`: A concatenated string of paper abstracts, findings, or a full literature review summary.
- `domain`: The specific academic domain or sub-field (e.g., "Natural Language Processing", "Quantum Physics").

**Example Input:**
```json
{
  "domain": "LLM Agents",
  "literature_summary": "Recent papers show agents are good at coding (Paper A) and browsing (Paper B), but both struggle with long-horizon memory degradation."
}
```
