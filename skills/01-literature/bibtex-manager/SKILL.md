---
name: bibtex-manager
description: Parse, generate, and manage BibTeX references. Use this tool when you need to format citations, add references to a project, or generate standard BibTeX strings from paper metadata.
---

# BibTeX Manager

This skill helps you generate and manage BibTeX entries. Currently, it supports generating BibTeX strings from paper metadata.

## Supported Actions

### generate
Takes paper metadata and formats it into a standard `@article` BibTeX entry. It auto-generates a citation key based on the first author's last name, the year, and the first word of the title.

**Example Input:**
```json
{
  "action": "generate",
  "metadata": {
    "title": "Attention Is All You Need",
    "authors": ["Ashish Vaswani", "Noam Shazeer"],
    "year": 2017
  }
}
```
