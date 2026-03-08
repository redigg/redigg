---
name: agent-orchestration
description: Create and manage sub-agents to perform tasks in parallel
tags: [system, agent, orchestration]
---

# Agent Orchestration

This skill allows the main agent to spawn sub-agents and delegate tasks to them.

## Actions

### create_agent
Create a new sub-agent.

**Parameters:**
- `name` (required): Name of the sub-agent.
- `role` (required): Role description (e.g. "Researcher", "Coder").

### list_agents
List all active sub-agents.

### delegate
Delegate a task to a specific sub-agent.

**Parameters:**
- `agentId` (required): The ID of the sub-agent.
- `task` (required): Task description.
- `skills` (optional): Array of skill IDs the sub-agent should use.

### parallel_execution
Execute multiple tasks in parallel using different agents. (Advanced)

## Examples

- "Create a research assistant" -> `create_agent(name="Alice", role="Researcher")`
- "Ask Alice to search for papers" -> `delegate(agentId="<alice_id>", task="Search for LLM papers", skills=["literature_review"])`
