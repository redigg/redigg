---
name: scheduling
description: Schedule and manage automated tasks (cron)
tags: [system, cron, tasks]
---

# Scheduling

This skill allows the agent to schedule tasks to run automatically at specified times.

## Actions

### schedule_task
Schedule a new recurring task.

**Parameters:**
- `name` (required): Name of the task.
- `cron` (required): Cron expression (e.g. "0 * * * *").
- `skill` (required): The ID of the skill to execute.
- `params` (optional): JSON object of parameters for the skill.

### list_tasks
List all scheduled tasks.

### remove_task
Stop and remove a scheduled task.

**Parameters:**
- `taskId` (required): The ID of the task to remove.

## Examples

- "Check weather every hour" -> `schedule_task(name="Check Weather", cron="0 * * * *", skill="weather_skill", params={})`
