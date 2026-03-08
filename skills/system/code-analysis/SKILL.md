---
name: code-analysis
description: Analyze project structure, scan codebase stats, and summarize code files
tags: [code, analysis, summary, scan]
---

# Code Analysis

This skill provides capabilities to analyze the codebase structure, scan for overall statistics, and summarize individual files.

## Instructions

Use this skill when the user asks to:
- Understand the project structure
- Get an overview of the codebase (size, languages, key files)
- Summarize what a specific file does
- Analyze code statistics (SLOC, imports, exports)

## Actions

### structure
Recursively lists the file structure of the project, ignoring `node_modules` and hidden files.

**Parameters:**
- `path` (optional): The root directory to analyze. Defaults to current working directory.

### scan
Scans the codebase to provide a high-level summary including total files, directories, size, SLOC, and language breakdown.

**Parameters:**
- `path` (optional): The root directory to scan. Defaults to current working directory.

### summarize
Provides a summary of a specific code file or directory. For files, it may use LLM to generate a description.

**Parameters:**
- `path` (required): The path to the file or directory to summarize.

## Examples

- "Show me the project structure" -> `structure`
- "Scan the codebase" -> `scan`
- "Analyze src/index.ts" -> `summarize(path="src/index.ts")`
