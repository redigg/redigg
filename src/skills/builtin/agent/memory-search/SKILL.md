---
name: memory-search
description: Search through research notes, conversation history, and user preferences stored in the agent's long-term memory.
---

# Memory Search

This system skill allows the agent to retrieve historical context from its memory store. It uses vector or keyword search to find relevant information from past sessions, saved papers, or learned preferences.

## Parameters
- `query`: The search query or keyword to find in memories.
- `type`: (Optional) Filter by a specific memory type (e.g., `preference`, `fact`, `context`, `paper`, `experiment`).
- `limit`: (Optional) Maximum number of results to return (default: 5, max: 20).

**Example Input:**
```json
{
  "query": "What was the python library the user prefers for plotting?",
  "type": "preference",
  "limit": 3
}
```
