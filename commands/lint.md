---
description: "Check SKILL.md files for Review Readiness -- metadata completeness, activation clarity, scope clarity, context efficiency, and security signals"
argument-hint: "[path/to/SKILL.md | blank for all skills]"
---

**Input**: $ARGUMENTS

Run the check command:

```bash
node <skill-dir>/skill-guide.js --check $ARGUMENTS
```

When run without arguments, checks all installed skills. When given a file path, checks that specific SKILL.md. Add `--format json` for machine-readable output.

Review the findings and suggest improvements for low-scoring skills. Each skill is scored across 5 dimensions:
- **Metadata Completeness**: name, description, triggers, tools
- **Activation Clarity**: when-to-use section, specific triggers
- **Scope Clarity**: limitations, negative use cases
- **Context Efficiency**: description length, token usage
- **Review Priority**: security signals, broad permissions

A lower score means the skill may need more human review, not that it is bad or unsafe.
