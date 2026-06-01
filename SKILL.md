---
name: skill-guide
description: Use when the user wants to discover, inspect, compare, diagnose, or choose installed Agent Skills across Codex, Claude Code, cc-switch, or plugin directories.
allowed-tools:
  - Bash
---

# Skill Guide

## Overview

Use the bundled zero-dependency CLI to scan local skill metadata and generate a browser-ready HTML dashboard. Treat health scores and recommendations as local review prompts, not usage metrics or deletion decisions.

## Workflow

1. Infer the requested mode from the user's request.
2. Run the matching command from this skill directory.
3. Add `--lang zh` for a Chinese dashboard. English is the default.
4. Add `--open` unless the user asks for terminal output or a file only.
5. Summarize the generated result and report the output path when HTML is created.

| User goal | Command |
|---|---|
| Dashboard | `node <skill-dir>/skill-guide.js` |
| Find or inspect a skill | `node <skill-dir>/skill-guide.js --find "<query>"` |
| Diagnose local setup | `node <skill-dir>/skill-guide.js --doctor` |
| Review directory mentions | `node <skill-dir>/skill-guide.js --recommend` |
| Generate a share page | `node <skill-dir>/skill-guide.js --share [--user <name>]` |
| Generate a full manual | `node <skill-dir>/skill-guide.js --full` |
| Return structured data | `node <skill-dir>/skill-guide.js --format json` |

Use `--refresh` when the user expects newly installed or removed skills to appear. Use `--all` only when the user wants a cross-platform inventory. Add `--platform claude` or `--platform codex` to force a specific platform view regardless of auto-detection.

## Guardrails

- The scanner reads local metadata; it does not measure actual usage frequency.
- Same-category suggestions and directory mentions require human review before installing, editing, or deleting anything.
- Never delete skills, install packages, or publish results based only on a generated score.
- The default dashboard includes a "Review Candidates" slide with evidence-based findings and a Copy Prompt button. The CLI only prepares evidence and questions — semantic judgment comes from the agent. Always wait for agent assessment before acting on any finding.
- The `--review --format json` flag outputs a structured brief for programmatic agent consumption (no HTML).
- Built-in dashboard labels support English and Chinese. For other languages, summarize the result in the user's language without rewriting generated HTML unless explicitly requested.
- If the CLI is unavailable, report the missing file instead of silently replacing its behavior.
- All modes default to the current platform (auto-detected from env vars or install path). Cross-agent duplicates are normal — each agent needs its own skill copies. Use `--all` to see the full inventory across all agents.
