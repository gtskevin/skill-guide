# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

skill-guide is a zero-dependency CLI that scans Claude Code, Codex, cc-switch, and plugin skill directories, then generates HTML slide presentations showing what skills are installed. Published as an npm package and installable as a Claude Code/Codex skill. Supports multilingual output (auto-detected from user input).

## Commands

```bash
npm test                # Syntax check + unit tests + scanner smoke tests (the full CI gate)
node --test test/*.test.js   # Run just the unit tests

node scan-skills.js --list                # List all discovered skills (JSON)
node scan-skills.js --skill <name>        # Deep-dive one skill (JSON)
node scan-skills.js --search <query>      # Search skills by keyword (JSON)
node scan-skills.js --full                # All skills with full data (JSON)
node scan-skills.js --refresh --list      # Force re-scan (ignore 5-min cache)

node skill-guide.js --open                # Overview: categories, token budget, highlights
node skill-guide.js --search <query> --open
node skill-guide.js --skill <name> --open
node skill-guide.js --full --open
node skill-guide.js --insight --open      # Health, budget, community, prescriptions (replaces --health/--wrapped)
node skill-guide.js --recommend --open    # Show recommendations from online directories
node skill-guide.js --share --open        # Generate shareable portfolio page
node skill-guide.js --doctor              # Diagnose skill paths, sources, duplicates, malformed files
node skill-guide.js --lang zh --open      # Chinese UI labels (builtined)
```

## Architecture

Three-file pipeline, all CommonJS, zero npm dependencies:

- **`scan-skills.js`** (~580 lines) — Data layer. Scans 6 source directories (`~/.claude/skills`, `~/.codex/skills`, `~/.codex/skills/.system`, `~/.cc-switch/skills`, `~/.claude/plugins/marketplaces`, `~/.codex/plugins/cache`), parses YAML frontmatter from `SKILL.md`/`README.md` files using a regex-based parser (no YAML library), auto-categorizes into 9 categories, extracts sections and contextual paragraphs. Caches results in `/tmp/claude/` with 5-minute TTL keyed by source paths. Outputs JSON to stdout.

- **`skill-guide.js`** (~770 lines) — Presentation layer. Invokes `scan-skills.js` via `execFileSync`, transforms scanner JSON into a single-file HTML document with scroll-snap slides, CSS custom properties, IntersectionObserver animations, and keyboard navigation. Built-in i18n for English and Chinese (`--lang zh`). For other languages, SKILL.md workflow delegates translation to the agent. Also handles `--doctor` diagnostics, `--share` portfolio pages, `--recommend` reports, and `--format json` passthrough.

- **`skill-registry.js`** (~250 lines) — Online directory layer. Fetches curated skill lists from GitHub awesome-lists and community directories, caches results with 1-hour TTL. Exports `fetchRecommendations()` for `--recommend` mode and `fetchRegistry()` for `--share` mode. Used by `skill-guide.js` via `require()`.

- **`SKILL.md`** (~267 lines) — Skill definition consumed by Claude Code and Codex. Contains mode detection rules (4 modes), 7-step workflow with language detection, HTML generation specs, and anti-patterns. The agent-side translation step handles all non-English/non-Chinese languages.

- **`bin/skill-guide`** — npm bin entry point, requires `skill-guide.js`.

## Language Support Architecture

- **English**: Default, no translation needed. `--open` added directly.
- **Chinese**: Built-in label map in `skill-guide.js` (LABELS.zh). `--lang zh` flag triggers Chinese UI labels at generation time.
- **Other languages (ja, ko, fr, de, es, etc.)**: CLI generates English HTML. The agent (Claude/Codex) reads the HTML, translates all text content (both `data-i18n` marked and plain text), writes it back, then opens it. This keeps the CLI zero-dependency while supporting unlimited languages.

## Constraints

- **Zero npm dependencies** — only `fs`, `path`, `os`, `crypto`, `child_process` (Node built-ins).
- **`scan-skills.js` stays one file** — do not split into modules.
- **No network calls in scanner** — `scan-skills.js` reads local files only. `skill-registry.js` fetches from GitHub awesome-lists (uses `curl` via `child_process`).
- **`SKILL.md` frontmatter** must follow Claude Code skill conventions (`name`, `description`, `allowed-tools`).
- Requires Node.js >= 18 (uses `node:test`, `node:assert/strict`, `Array.from`).

## Testing

Tests use Node.js built-in test runner (`node:test`). Each test creates an isolated temp directory as a fake `$HOME`, writes `SKILL.md` fixtures, and runs the scanner/CLI against it with overridden env vars.

- `test/scan-skills.test.js` — Scanner unit tests: source labeling, cache isolation, frontmatter parsing, deduplication, system-vs-user skill separation, multiline descriptions, quoted values, duplicate source labels.
- `test/cli.test.js` — CLI integration tests: HTML generation, doctor mode, JSON output format.
- `test/registry.test.js` — Registry unit tests: cache key determinism, cache round-trip, expiration, clearing, markdown list parsing.
- `test/translate.test.js` — Translation tests: Chinese label rendering, English preservation, section title/summary translation, UI label localization.

CI runs on Node 18/20/22 across ubuntu-latest and macos-latest (`.github/workflows/test.yml`).
