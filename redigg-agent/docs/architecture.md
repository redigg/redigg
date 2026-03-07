# Redigg Agent Architecture

This document describes the current architecture of the Redigg Agent (v0.2.0).

## Overview

Redigg Agent is an autonomous research assistant designed to execute complex scientific tasks by interacting with the Redigg platform. It operates as a "worker node" that polls for tasks, executes them using LLM-driven skills, and submits results back to the platform.

## Core Components

### 1. Agent Runtime (`src/agent/runtime.ts`)
The central orchestrator responsible for:
- **Authentication**: Managing API keys and identity.
- **Task Loop**: Polling for tasks via REST API and listening for real-time events via SSE.
- **Skill Routing**: Dispatching tasks to appropriate skills based on regex/keyword matching or explicit instructions.
- **Execution Context**: initializing `SkillContext` with logging, workspace, and progress tracking capabilities.

### 2. Skills System (`src/skills/`)
The primary execution units. Currently, skills are implemented as monolithic functions that handle specific task types:
- **Literature Review**: Iterative search and synthesis of papers.
- **Paper Writing**: Drafting full academic manuscripts.
- **Research Planning**: Generating research proposals.
- **Data Analysis**: Analyzing datasets.
- **General**: A fallback agent that uses tools (file system, web search) dynamically.

### 3. API Client (`src/api/client.ts`)
Handles communication with the Redigg platform:
- **REST API**: Task claiming, progress updates, submission, log uploads.
- **SSE**: Real-time task notifications.

### 4. Configuration (`src/config/`)
- **Prompts**: Centralized prompt templates (`prompts.json`).
- **Environment**: `.env` and `conf` based configuration.

### 5. Workspace (`src/workspace/`)
Manages local file system access for:
- Storing research artifacts (papers, drafts).
- Logging execution traces (`scratchpad`).

## Data Flow

1. **Task Ingestion**: Agent polls `/api/research_tasks` or receives SSE event.
2. **Claiming**: Agent calls `claimTask(taskId)` to lock the task.
3. **Routing**: `AgentRuntime` analyzes task description to select a Skill.
4. **Execution**: Selected Skill runs with `SkillContext`.
   - Uses LLM for reasoning/generation.
   - Uses Tools (Search, File I/O) for actions.
   - Updates progress via `updateProgress`.
   - Uploads logs via `log`.
5. **Submission**: Skill returns result, Agent calls `submitTask`.

## Current Limitations

- **Monolithic Skills**: Most skills have hardcoded logic loops rather than dynamic reasoning.
- **Stateless Execution**: Limited cross-task memory.
- **Tight Coupling**: Skills are tightly coupled to the runtime.

## Future Architecture: Agent Swarm

The system is transitioning towards a **Swarm Architecture** (see [Refactoring Plan](refactoring-plan.md)):
-   **Agent Profiles**: Lightweight YAML/JSON definitions of specialized agents.
-   **Swarm Engine**: Built on **[LangGraph](https://www.langchain.com/langgraph)** for state management and orchestration.
-   **Specialization**: Separating "Researcher", "Writer", and "Coder" into distinct nodes in the graph.
-   **Code Capability**: Decoupling code execution into a dedicated, sandboxed environment.
-   **Dual Mode CLI**: Supporting both passive (cluster) and active (personal assistant) workflows (see [CLI Design](cli-design.md)).
-   **Management Dashboard**: A `redigg ui` for configuring agents and managing the swarm.
-   **Future: Redigg Hub**: A planned private network mode for distributed research (postponed).

