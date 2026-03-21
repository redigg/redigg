---
name: plot-generator
description: Generate publication-quality figures using Python matplotlib or seaborn.
---

# Plot Generator

Executes a Python script specifically designed to render and save an image/plot file to disk.

## Important Note
This skill does NOT write the code for you. You must provide the complete, working Python script. If you need help writing the script based on a description, use the `figure-generator` skill instead.

## Requirements
- The script MUST contain a command to save the figure to disk (e.g., `plt.savefig("output.png")`).
- Do NOT use `plt.show()` as the environment is headless.

## Parameters
- `script`: The Python code to run.
- `output_filename`: The exact filename the script will save the image to (used for verification).

**Example Input:**
```json
{
  "script": "import matplotlib.pyplot as plt\nplt.plot([1,2,3])\nplt.savefig('test_plot.png')",
  "output_filename": "test_plot.png"
}
```
