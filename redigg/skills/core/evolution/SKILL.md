---
name: evolution
description: Self-evolve by creating or improving skills
tags: [system, evolution, meta]
---

# Evolution

This skill allows the agent to modify its own capabilities by generating new skills or updating existing ones.

## Actions

### create_skill
Generates a new skill based on a description or intent.

**Parameters:**
- `intent` (required): Description of what the new skill should do.
- `feedback` (optional): Additional context or constraints.

### improve_skill
Updates an existing skill based on feedback. (Future)

## Examples

- "Create a skill to fetch weather data" -> `create_skill(intent="fetch weather data")`
