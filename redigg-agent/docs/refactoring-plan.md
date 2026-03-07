# Refactoring Plan: Redigg Agent Swarm Architecture

This document outlines the architectural transformation of `redigg-agent` from a monolithic skill-based agent into a **lightweight, dynamic Agent Swarm**.

## Core Philosophy

> "Instead of one agent with 10,000 skills, we want 10,000 specialized agents, each mastering a few skills."

-   **Specialization**: Limit the scope of each agent to improve reliability and reduce token usage.
-   **Dynamic Orchestration**: A coordinator dynamically assembles a team of agents based on the task.
-   **Tool Efficiency**: Prevent tool explosion by scoping tools to specific agents.
-   **Code Decoupling**: Treat coding as a specialized capability (like "Claude Code") rather than a general skill mixed with reasoning.

## 1. Agent Profile (The "DNA")

Agents are defined by **Profiles** stored as Markdown files with frontmatter.

**Location**: `~/.redigg/profiles/*.md` or `src/profiles/*.md` (built-in).

**Structure (`researcher.md`):**
```markdown
---
name: "DataAnalyst"
description: "Expert in analyzing structured data using Python and Pandas."
capabilities:
  - "code_execution"
  - "file_reading"
tools:
  - "generate_chart"
  - "calculate_statistics"
environment:
  docker_image: "redigg/data-science:latest"
---

# System Prompt
You are a senior data scientist. You prefer using Pandas for...
```

**Types of Agents:**
1.  **Orchestrator**: The "Manager". Decomposes tasks and routes them to workers.
2.  **Worker**: Specialized agents (Writer, Reviewer, Analyst, Searcher).
3.  **Coder**: Dedicated coding agent (wraps robust coding tools).

## 2. Swarm Engine (Powered by LangGraph)

We will leverage **[LangGraph](https://www.langchain.com/langgraph)** as the underlying orchestration engine to manage state, transitions, and persistence.

-   **State Management**: Use LangGraph's `StateGraph` to define the shared schema (messages, artifacts, current_agent).
-   **Nodes as Agents**: Each agent profile (Researcher, Writer) becomes a node in the graph.
-   **Edges as Handoffs**: Transitions between agents are modeled as conditional edges.
-   **Persistence**: Built-in checkpointer for long-running tasks and "pause/resume" functionality.

**Execution Flow (Graph-based):**
1.  **Entry Node**: `Supervisor` (Orchestrator) receives the user input.
2.  **Routing**: Supervisor decides the next node (e.g., `research_node`) based on the plan.
3.  **Execution**: `research_node` executes (loading tools from `researcher.md`).
4.  **Loop/Finish**: The graph continues until a `END` condition is met.

## 3. Code Capability Decoupling (Claude Code Integration)

Coding is a distinct, high-risk, high-complexity capability. Instead of reinventing the wheel, we will integrate specialized coding agents.

-   **Primary Backend**: **[Claude Code](https://code.claude.com)** (via CLI).
    -   `CoderAgent` wraps the `claude` command.
    -   Supports headless execution: `claude "fix bug in src/utils.ts"`.
    -   Handles file modifications directly.
-   **Fallback/Alternative**: Local interpreter or `aider` for environments where `claude` is unavailable.
-   **Sandboxing**: Run `claude` or other tools within Docker containers for safety.

## 4. CLI Experience (Dual Mode)

See [CLI Design Document](cli-design.md) for detailed commands and workflows.

The CLI will support two primary modes:
1.  **Passive Mode (Cluster Worker)**: `redigg serve`. Headless daemon for the Redigg network.
2.  **Active Mode (Personal Assistant)**: `redigg "instruction"`, `redigg` (REPL). Interactive local research co-pilot.

**Dashboard (`redigg ui`)**:
-   Primary interface for **Agent Configuration** and **Multi-Agent Management**.
-   Visualizes swarm activity.

**Future: Redigg Hub**:
-   A planned private network mode to synchronize work and dispatch tasks to a cluster of agents.
-   *Status: Postponed (High complexity).*

### Slash Commands
        -   `/compact`: Summarize history to save tokens.
        -   `/clear`: Reset context.
        -   `/cost`: Show token usage.
        -   `/handoff [agent]`: Manually switch to a specific agent profile.
        -   `/add [file/dir]`: Add file to context.
        -   `/remove [file]`: Remove file from context.
        -   `/sync`: Push state to cloud.

Both modes leverage the same underlying **Swarm Engine** and **Agent Profiles**.

## 5. Implementation Stages

### Phase 1: Profile System & LangGraph Base
-   Define `AgentProfile` schema (Nodes).
-   Set up **LangGraph** structure:
    -   Create `StateGraph` for shared state.
    -   Implement `ProfileNode` that loads tools dynamically.
-   Refactor existing Skills into `Worker` profiles (e.g., `LiteratureReviewSkill` -> `researcher_node`).

### Phase 2: Dynamic Orchestration & Routing
-   Implement `Orchestrator` node (Supervisor).
-   Define conditional edges for handoffs.
-   "Kimi Agent Swarm" style dynamic team assembly using LangGraph.

### Phase 3: Code Specialist & Persistence
-   Build `CoderAgent` (integrated as a special node).
-   Enable LangGraph Checkpointing for long-running task persistence.
-   Integrate with `redigg ui` for graph visualization.

## 6. Directory Structure Preview

```
src/
  swarm/           # The Engine (LangGraph)
    graph.ts       # Main StateGraph definition
    nodes/         # Node implementations
      supervisor.ts
      worker.ts    # Generic worker for profiles
      coder.ts
    state.ts       # Shared state schema
    checkpointer.ts # Persistence layer
  profiles/        # Agent Definitions (YAML/MD)
    orchestrator.md
    researcher.md
    writer.md
    coder.md
  tools/           # Granular Tools
    claude_wrapper.ts
    search.ts
    filesystem.ts
  gateway/         # Connection to Redigg/User
```

## 7. Migration from Current Architecture

1.  **Keep `AgentRuntime`** as the entry point (Gateway).
2.  **Replace `executeTask`**: Instead of calling a Skill directly, it instantiates the `Orchestrator` agent.
3.  **Wrap Skills**: Existing skills become the first set of "Worker Agents".
