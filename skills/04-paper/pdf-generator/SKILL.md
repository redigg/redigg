---
name: pdf-generator
description: Generate high-quality PDF documents from text or markdown using LaTeX. Use this when you need to output a final academic paper or report.
compatibility: Requires pdflatex installed on the host system.
---

# PDF Generator (LaTeX)

Generate high-quality PDF documents from text or markdown using LaTeX.
This skill creates a `.tex` file and compiles it to PDF.

## Dependencies
- `pdflatex` must be installed on the system (e.g., via TeX Live or MacTeX).

## Usage
Provide the `content` (markdown or plain text) and a `title`.
The skill will:
1. Convert the content to LaTeX format (using an academic template).
2. Write the `.tex` file to the workspace.
3. Run `pdflatex` to generate the PDF.
4. Return the path and URL to the generated PDF.

## Parameters
- `title`: Title of the document.
- `content`: Markdown formatted string containing the paper's body.
- `authors`: (Optional) Array of author names.

**Example Input:**
```json
{
  "title": "A Survey on Agent Frameworks",
  "content": "# Abstract\nThis paper reviews...",
  "authors": ["Alice", "Bob"]
}
```
