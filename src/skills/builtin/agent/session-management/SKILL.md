---
name: session-management
description: Manage chat sessions and history
tags: [system, session, history]
---

# Session Management

This skill allows the agent to manage user sessions and chat history.

## Actions

### list_sessions
List all active sessions for the current user.

### get_history
Retrieve message history for a session.

**Parameters:**
- `sessionId` (optional): If not provided, uses current active session.
- `limit` (optional): Number of messages to retrieve (default 10).

### clear_history
Clear message history for a session.

**Parameters:**
- `sessionId` (optional): If not provided, uses current active session.

### summarize_session
Generate a summary of the current session. (Future)

## Examples

- "Show my chat history" -> `get_history`
- "Clear this session" -> `clear_history`
