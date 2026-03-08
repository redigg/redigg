---
name: memory-management
description: Manage and consolidate agent memories (Working, Short-term, Long-term)
tags: [memory, system, consolidation]
---

# Memory Management

This skill allows the agent to actively manage its own memory system.

## Actions

### consolidate
Triggers the memory consolidation process.
- Moves old working memories to short-term.
- Promotes high-value short-term memories to long-term.
- Prunes low-value, old memories.

**Parameters:**
- `userId` (optional): The user ID to consolidate memories for. Defaults to current user.

### search
Search through the agent's memories.

**Parameters:**
- `query` (required): The search term.
- `limit` (optional): Max results (default 5).
- `type` (optional): Filter by type (preference, fact, context, paper, experiment).
- `tier` (optional): Filter by tier (working, short_term, long_term).

### retrieve
Retrieve all memories of a specific tier (e.g. "show me long term memories").

**Parameters:**
- `tier` (required): working, short_term, or long_term.


## Examples

- "Consolidate my memories" -> `consolidate`
