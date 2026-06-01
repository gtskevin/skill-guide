---
description: "Structured review brief for agents -- security flags, duplicates, overlaps, budget analysis"
argument-hint: "[blank for full review]"
---

Run the review command and return the JSON brief:

```bash
node <skill-dir>/skill-guide.js --review --format json --refresh
```

The output is a structured JSON brief with security, duplicate, malformed, overlap, and budget items. Each item has a `question` field for agent assessment. Wait for agent assessment before acting on any finding. Never delete skills based only on generated scores.
