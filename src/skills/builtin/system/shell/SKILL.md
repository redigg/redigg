---
name: shell
description: Execute shell commands in the workspace environment. Use this to run standard bash commands, install packages, or run scripts.
---

# Shell Executor

Executes arbitrary shell commands in a sandbox or local workspace. This is a powerful but dangerous tool.

## Safety
Certain commands (like `rm -rf /`, `mkfs`, `dd`) are blocked at the application level.

## Parameters
- `command`: The shell command to execute.

**Example Input:**
```json
{
  "command": "ls -la src/ && python3 --version"
}
```
