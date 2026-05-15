# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

skill-guide is a zero-dependency CLI that scans Claude Code, Codex, cc-switch, and plugin skill directories, then generates HTML slide presentations showing what skills are installed. Published as an npm package and installable as a Claude Code/Codex skill.

## Commands

```bash
npm test                # Syntax check + unit tests + scanner smoke tests (the full CI gate)
node --test test/*.test.js   # Run just the unit tests

node scan-skills.js --list                # List all discovered skills (JSON)
node scan-skills.js --skill <name>        # Deep-dive one skill (JSON)
node scan-skills.js --search <query>      # Search skills by keyword (JSON)
node scan-skills.js --full                # All skills with full data (JSON)

node skill-guide.js --open                # Generate HTML guide and open in browser
node skill-guide.js --search <query> --open
node skill-guide.js --skill <name> --open
node skill-guide.js --full --open
node skill-guide.js --doctor              # Diagnose skill paths, sources, duplicates, malformed files
```

## Architecture

Two-file pipeline, both CommonJS, zero npm dependencies:

- **`scan-skills.js`** — Data layer. Scans 6 source directories (`~/.claude/skills`, `~/.codex/skills`, `~/.codex/skills/.system`, `~/.cc-switch/skills`, `~/.claude/plugins/marketplaces`, `~/.codex/plugins/cache`), parses YAML frontmatter from `SKILL.md`/`README.md` files using a regex-based parser (no YAML library), auto-categorizes into 9 categories, extracts sections and contextual paragraphs. Caches results in `/tmp/claude/` with 5-minute TTL keyed by source paths. Outputs JSON to stdout.

- **`skill-guide.js`** — Presentation layer. Invokes `scan-skills.js` via `execFileSync`, transforms scanner JSON into a single-file HTML document with scroll-snap slides, CSS custom properties, IntersectionObserver animations, and keyboard navigation. Also handles `--doctor` diagnostics and `--format json` passthrough.

- **`SKILL.md`** — Skill definition consumed by Claude Code and Codex. Contains mode detection rules, HTML generation specs, and language handling. The agent reads this to know how to invoke the CLI.

- **`bin/skill-guide`** — npm bin entry point, requires `skill-guide.js`.

## Constraints

- **Zero npm dependencies** — only `fs`, `path`, `os`, `crypto`, `child_process` (Node built-ins).
- **`scan-skills.js` stays one file** — do not split into modules.
- **No network calls** — scanner reads local files only.
- **`SKILL.md` frontmatter** must follow Claude Code skill conventions (`name`, `description`, `allowed-tools`, `triggers`).
- Requires Node.js >= 18 (uses `node:test`, `node:assert/strict`, `Array.from`).

## Testing

Tests use Node.js built-in test runner (`node:test`). Each test creates an isolated temp directory as a fake `$HOME`, writes `SKILL.md` fixtures, and runs the scanner/CLI against it with overridden env vars.

- `test/scan-skills.test.js` — Scanner unit tests: source labeling, cache isolation, frontmatter parsing, deduplication, system-vs-user skill separation.
- `test/cli.test.js` — CLI integration tests: HTML generation, doctor mode, JSON output format.

CI runs on Node 18/20/22 across ubuntu-latest and macos-latest (`.github/workflows/test.yml`).
