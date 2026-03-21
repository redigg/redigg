---
name: figure-generator
description: Create publication-ready figures by converting a natural language description into a Python plot script and rendering the image.
---

# Publication Figure Generator

This macro-skill uses an LLM to translate your requirements into a working matplotlib Python script, and then delegates the execution to the `plot-generator` skill to save the figure locally.

## Process
1. Translates `title` and `description` into a valid Python script.
2. Calls the execution sandbox to run the script.
3. Verifies that the file (e.g. `.png` or `.pdf`) was actually created on disk.

## Parameters
- `title`: The title of the figure.
- `description`: A detailed description of what the figure should show (e.g., data points, axes labels, visual styling).
- `filename`: The desired output filename (must end in `.png` or `.pdf`).

**Example Input:**
```json
{
  "title": "Agent Performance",
  "description": "A bar chart comparing Human vs Agent performance across 3 benchmarks (Math, Coding, Writing).",
  "filename": "performance_comparison.png"
}
```
