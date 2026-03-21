---
name: data-analysis
description: Run Python scripts for statistical analysis (pandas, numpy, scipy). Use this to process experimental results or calculate metrics.
---

# Data Analysis (Python)

This skill provides an isolated environment to execute Python code specifically targeted at data analysis.

## Requirements
- The execution environment must have python3 installed.
- Standard libraries like `pandas`, `numpy`, and `scipy` are assumed to be available.

## Parameters
- `script`: The raw Python code to execute. Do not wrap in markdown tags.
- `requirements`: (Optional) An array of pip packages required for the script to run.

**Example Input:**
```json
{
  "script": "import pandas as pd\nimport numpy as np\ndata = [1, 2, 3, 4, 5]\nprint(f'Mean: {np.mean(data)}')",
  "requirements": ["pandas", "numpy"]
}
```
