# Redigg CLI Design Reference

Inspired by [Claude Code CLI](https://code.claude.com/docs/en/cli-reference), Redigg CLI is designed to be a natural extension of your research workflow.

## Global Flags

| Flag | Description |
| :--- | :--- |
| `-p, --print` | Print the result to stdout (for headless scripting). |
| `-s, --silent` | Run in silent mode. Output is saved to the default workspace directory instead of stdout. |
| `--verbose` | Enable detailed logging (agent thought process, tool calls). |
| `--dangerously-skip-permissions` | **(Active Mode Only)** Skip permission prompts for file writes/shell execution. |
| `--version` | Show version. |

---

## 1. Active Mode (Personal Research Assistant)

### Interactive REPL
Start a conversational session with the agent swarm.

```bash
redigg
# or
cd ./my-project && redigg
```

**Slash Commands (In-Session):**
| Command | Description |
| :--- | :--- |
| `/compact` | Summarize conversation history to save tokens. |
| `/clear` | Clear conversation history and reset context. |
| `/cost` | Show token usage and estimated cost for the current session. |
| `/handoff [agent]` | Manually transfer control to a specific agent profile (e.g., `/handoff coder`). |
| `/add [file/dir]` | Explicitly add a file or directory to the context. |
| `/remove [file]` | Remove a file from the context. |
| `/bug` | Report an issue with the CLI. |
| `/sync` | Manually trigger a synchronization to Redigg.com (useful if auto-sync fails). |

### One-Shot (Headless)
Execute a single research task and exit. Ideal for scripting or quick queries.

```bash
# Analyze a topic and print the report
redigg "Conduct a literature review on AI-driven material science" --print > report.md

# Pipe input
cat data.csv | redigg "Analyze this data and generate a summary"

# Silent mode (auto-save to workspace)
redigg "Research quantum computing trends" --silent
# Output saved to ~/.redigg/workspace/research-quantum-computing-trends-<timestamp>.md
```

### Dashboard & Management
Configure agents, manage the swarm, and visualize activity.

```bash
# Start the local dashboard
redigg ui
```

**Features:**
- **Agent Configuration**: Create, edit, and tune agent profiles.
- **Multi-Agent Management**: Monitor and orchestrate multiple running agents.
- **Visualization**: View the swarm's activity and knowledge graph.

> **Note:** The CLI automatically syncs the workspace state to Redigg.com for visualization.
> Use `redigg sync` (or `/sync` in REPL) to manually trigger a sync if needed.

### Future: Redigg Hub (Private Network)
*Planned but currently postponed.*
A private network mode where a central "Hub" synchronizes work and dispatches tasks to connected agents in a research cluster.

---

## 2. Passive Mode (Cluster Node)

Turn your machine into a background worker for the Redigg Network using a single execution command.

### Start Worker
Start the node in execution mode. It will connect to the Redigg Gateway, authenticate, and poll for tasks matching its profile.

```bash
# Basic worker (processes any assigned task)
redigg serve --token <owner_token>

# Specialized worker (filters by capability/tag)
redigg serve --tags "bio, genomics" --capabilities "gpu"

# Dedicated worker (only processes tasks for a specific research ID)
redigg serve --research_id <research_id>
```

**Behavior:**
- Runs as a long-lived process (daemon).
- Automatically claims pending tasks.
- Executes tasks using the local Swarm Engine.
- Uploads results and logs to Redigg.com.

---

## 3. Configuration & File Structure

Redigg adopts a file-centric configuration approach, similar to OpenClaw.

### Initialization
```bash
redigg init
```
*Effect*: Creates the default directory structure at `~/.redigg/`.

### Directory Structure
```
~/.redigg/
├── config.yaml       # API Keys, Gateway settings, Swarm config
├── agent.md          # Primary Agent Identity (System Prompt, Description)
├── workspace/        # Default directory for research artifacts
└── agents/         # Specialized Agent Profiles
    ├── researcher.md
    └── coder.md
```

### Agent Profile (`agent.md`) Format
```markdown
---
name: "MyPersonalResearcher"
model: "claude-3-5-sonnet"
tools: ["search", "fs"]
---

# System Prompt
You are a rigorous research assistant. You prefer primary sources...
```

### Manage Config
```bash
# Set keys (updates config.yaml)
redigg config set redigg.apiKey <key>
```

## 4. Updates

Update the CLI to the latest version.

```bash
redigg update
```
