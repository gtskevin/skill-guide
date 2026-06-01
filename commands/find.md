---
description: "Deep dive into a specific skill or search across all installed skills"
argument-hint: "<skill-name or search-query>"
---

**Input**: $ARGUMENTS

Run the find command:

```bash
node <skill-dir>/skill-guide.js --find "$ARGUMENTS" --open
```

If the exact skill is found, a deep-dive HTML is generated. If not, a search across triggers and descriptions is performed. Summarize the result and report the output path.
