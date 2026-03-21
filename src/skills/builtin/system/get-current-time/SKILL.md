---
name: get-current-time
description: Get the current system date and time. Use this when you need to stamp a file, check the date for API requests, or answer user queries about time.
---

# Get Current Time

Returns the current system time in a requested format.

## Parameters
- `format`: (Optional) The format to return the time in. Options: `iso`, `utc`, `local`. Defaults to `iso`.

**Example Input:**
```json
{
  "format": "utc"
}
```
