---
name: paper-reader
description: Extract and read text from PDF academic papers. Use this tool when you need to read the full text of a paper to answer specific questions or extract detailed methodologies.
---

# Paper Reader

This skill extracts text content from PDF files. It is useful for deeply analyzing papers that have been downloaded locally.

## Features
- Reads local PDF files.
- Returns the extracted text along with page counts and metadata.
- Truncates extremely long PDFs to prevent blowing up the LLM context window (caps at 50,000 characters).

## Parameters
- `file_path`: The absolute or relative path to the PDF file.

**Example Input:**
```json
{
  "file_path": "./downloads/attention_is_all_you_need.pdf"
}
```
