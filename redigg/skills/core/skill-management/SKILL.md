---
name: skill-management
description: Manage skill packs (load, unload, list)
tags: [system, management, packs]
---

# Skill Management

This skill allows the agent to manage its own skill sets (packs).

## Actions

### list_packs
List all loaded skill packs.

### unload_pack
Unload a specific skill pack.

**Parameters:**
- `packId` (required): The ID of the pack to unload.

### load_pack
Load a skill pack from disk (if not already loaded, or to reload).

**Parameters:**
- `packId` (required): The folder name of the pack in `skills/`.

## Examples

- "List loaded skill packs" -> `list_packs`
- "Unload the dev-tools pack" -> `unload_pack(packId="dev-tools")`
