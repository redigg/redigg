---
name: local-file-ops
description: List, read, organize, and search local research files
tags: [system, file, local]
---

# Local File Operations

This skill allows the agent to interact with the local filesystem.

## Instructions

Use this skill to:
- Explore the file system
- Read file contents
- Organize files (e.g. moving PDFs)
- Search for files by name

## Actions

### list
List files in a directory.

**Parameters:**
- `path`: Directory path (default: current)
- `recursive`: Boolean, whether to list recursively

### read
Read the content of a file.

**Parameters:**
- `path`: File path

### write
Write content to a file.

**Parameters:**
- `path`: File path
- `content`: Content string

### search
Find files matching a pattern.

**Parameters:**
- `pattern`: Search string (filename substring)
- `path`: Root directory

### organize
Organize files based on rules (currently specialized for PDFs).

**Parameters:**
- `operation`: 'organize'

## Security
Operations are restricted to the current workspace.
