# Literature Review Skill

**Skill Name**: literature_review  
**Version**: 1.0.0  
**Description**: Search for papers and generate a comprehensive literature review

---

## Overview

This skill searches for relevant academic papers using Semantic Scholar and synthesizes a state-of-the-art literature review.

---

## Capabilities

- 🔍 **Paper Search**: Search Semantic Scholar for relevant papers
- 📄 **Paper Retrieval**: Get paper details, abstracts, and citations
- 📝 **Synthesis**: Generate structured literature review in Markdown
- 📊 **Key Findings**: Extract and highlight key findings
- 🔬 **Research Gaps**: Identify open research questions and gaps
- 📚 **References**: Format citations properly

---

## Usage

### Task Types

This skill handles:
- `task.type = "literature_review"`
- `task.type = "survey"`
- Generic research tasks with keywords matching "literature", "survey", "related work", "state-of-the-art", "review"

### Parameters

```typescript
interface LiteratureReviewParams {
  topic: string;              // Research topic (required)
  max_papers?: number;         // Max papers to retrieve (default: 10)
  categories?: string[];       // arXiv categories (default: ["cs.AI", "cs.LG"])
  context?: string;            // Additional context/background
  target_venue?: string;       // Target venue/conference (optional)
}
```

### Example

```typescript
// Task configuration
{
  "type": "literature_review",
  "title": "Survey of Large Language Models",
  "parameters": {
    "topic": "large language models",
    "max_papers": 15,
    "categories": ["cs.CL", "cs.AI", "cs.LG"],
    "context": "Focus on recent advances from 2023-2026",
    "target_venue": "NeurIPS"
  }
}
```

---

## Skill Output

```typescript
interface LiteratureReviewResult {
  success: boolean;
  topic: string;
  summary: string;           // Full literature review in Markdown
  papers: Paper[];           // Retrieved papers
  key_findings: string[];    // Key findings bullet points
  research_gaps: string[];   // Research gaps identified
  references: string[];      // Formatted references
  paper_count: number;
}

interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  year: number;
  venue: string;
  citations: number;
  url: string;
}
```

---

## Dependencies

- **Semantic Scholar API**: For paper search and retrieval
- **LLM Provider**: For synthesis and review generation
- **citation-js**: For reference formatting

---

## Configuration

No special configuration required beyond the standard agent setup.

---

## Best Practices

1. **Topic Specificity**: Provide clear, specific topics for better results
2. **Category Selection**: Use appropriate arXiv categories for your field
3. **Context**: Add domain-specific context when available
4. **Venue Target**: Specify target venue for style matching

---

## Version History

- **1.0.0** (2026-03-04): Initial version
