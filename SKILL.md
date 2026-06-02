---
name: skill-guide
description: Use when the user wants to discover, inspect, compare, diagnose, or choose installed Agent Skills across Codex, Claude Code, cc-switch, or plugin directories.
allowed-tools:
  - Bash
---

# Skill Guide

## Overview

Use the bundled zero-dependency CLI to scan local skill metadata and generate a browser-ready HTML dashboard. Treat health scores and recommendations as local review prompts, not usage metrics or deletion decisions.

## Default: Dashboard

Run the default dashboard:

```bash
node <skill-dir>/skill-guide.js --open
```

Add `--lang zh` for a Chinese dashboard. Add `--refresh` to force re-scan. Add `--all` to see skills from all platforms. Add `--platform claude` or `--platform codex` to force a specific platform view.

## Sub-commands

For other modes, use sub-commands: `/skill-guide: review`, `/skill-guide: find`, `/skill-guide: doctor`, `/skill-guide: recommend`, `/skill-guide: share`, `/skill-guide: lint`. Or run `node <skill-dir>/skill-guide.js --overlap` to find semantically overlapping skills.

## Guardrails

- The scanner reads local metadata; it does not measure actual usage frequency.
- Same-category suggestions and directory mentions require human review before installing, editing, or deleting anything.
- Never delete skills, install packages, or publish results based only on a generated score.
- The CLI only prepares evidence and questions — semantic judgment comes from the agent. Always wait for agent assessment before acting on any finding.
- Built-in dashboard labels support English and Chinese. For other languages, summarize the result in the user's language without rewriting generated HTML unless explicitly requested.
- If the CLI is unavailable, report the missing file instead of silently replacing its behavior.
- All modes default to the current platform (auto-detected from env vars or install path). Cross-agent duplicates are normal — each agent needs its own skill copies. Use `--all` to see the full inventory across all agents.
