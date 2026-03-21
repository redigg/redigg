---
name: hypothesis-generator
description: Generate novel, testable research hypotheses based on a specific topic and background literature. Use this when brainstorming new research directions.
---

# Hypothesis Generator

This skill uses an LLM acting as a senior academic researcher to brainstorm highly specific and testable research hypotheses. It requires a core topic and some background context (usually derived from a literature review or gap analysis).

## Output Format
Returns a Markdown list containing the requested number of hypotheses. Each hypothesis includes:
1. The Hypothesis Statement
2. Rationale (Theoretical grounding)
3. Proposed Methodology (How to test it)

## Parameters
- `topic`: The core research topic or problem domain.
- `context`: Summary of background literature or current state of the art.
- `count`: (Optional) Number of hypotheses to generate. Defaults to 3.

**Example Input:**
```json
{
  "topic": "Mitigating Context Window Degradation",
  "context": "Current LLMs lose track of details in the middle of long contexts.",
  "count": 5
}
```
