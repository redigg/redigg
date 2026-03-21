---
name: browser-control
description: Fetch web pages and extract clean text content. Use this tool when you need to read documentation, scrape a blog post, or view an external URL.
---

# Web Browser / Fetcher

This skill visits a given URL, downloads the HTML, strips out all scripts/styles/navigation, and returns the clean text content.

## Limits
To prevent context overflow, extracted text is truncated to a maximum of 20,000 characters.

## Parameters
- `url`: The URL to fetch (must include `http://` or `https://`).
- `action`: (Optional) The action to perform. Currently only supports `fetch_text`.

**Example Input:**
```json
{
  "url": "https://en.wikipedia.org/wiki/Large_language_model",
  "action": "fetch_text"
}
```
