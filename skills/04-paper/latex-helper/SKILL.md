---
name: latex-helper
description: Generate LaTeX templates, tables, and equations. Use this tool when you need boilerplate code to start a new paper or complex formatting blocks.
---

# LaTeX Helper

This skill provides ready-to-use LaTeX snippets and boilerplate templates. It helps streamline the process of writing academic papers.

## Supported Actions
- `template`: Generates a standard `article` document class template with common packages (amsmath, graphicx) and a bibliography setup.
- `table`: (Draft) Triggers a request to format data into a LaTeX table.
- `equation`: (Draft) Triggers a request to format math into a LaTeX equation.

## Parameters
- `action`: What to generate (enum: `template`, `table`, `equation`).
- `data`: Context or data for generation (e.g., Document title, table rows, or equation description).

**Example Input:**
```json
{
  "action": "template",
  "data": "A Novel Approach to Autonomous Research"
}
```
