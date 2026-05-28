# Repository Guidelines

## Project Structure

```
skill-guide/
├── scan-skills.js       # Scanner — scans skill dirs, parses SKILL.md frontmatter, outputs JSON
├── skill-guide.js       # Presentation — transforms scanner JSON into HTML slide decks
├── skill-registry.js    # Online registry — fetches curated skill lists from GitHub
├── bin/skill-guide      # npm bin entry point
├── SKILL.md             # Skill definition consumed by Claude Code / Codex
├── test/                # Unit and integration tests (node:test)
│   ├── scan-skills.test.js
│   ├── cli.test.js
│   ├── registry.test.js
│   ├── translate.test.js
│   └── wrapped.test.js
├── docs/                # Analysis notes and design documents
└── agents/openai.yaml   # Agent configuration
```

Three-file CommonJS pipeline: `scan-skills.js` (data), `skill-guide.js` (presentation), `skill-registry.js` (online directories).

## Build, Test, and Development Commands

```bash
npm test                              # Full CI gate: syntax check + unit tests + smoke tests
node --test test/*.test.js            # Unit tests only
node scan-skills.js --list            # List discovered skills (JSON)
node skill-guide.js --open            # Generate HTML guide and open in browser
node skill-guide.js --doctor          # Diagnose skill paths and environment
node skill-guide.js --lang zh --open  # Chinese UI output
```

## Coding Style & Naming Conventions

- **Zero npm dependencies** — use only Node.js built-ins (`fs`, `path`, `os`, `crypto`, `child_process`).
- `scan-skills.js` must remain a single file — do not split into modules.
- No network calls in `scan-skills.js`; `skill-registry.js` may fetch from GitHub via `curl`.
- CommonJS (`require`/`module.exports`), `'use strict'` at top of every file.
- Requires Node.js >= 18 (uses `node:test`, `node:assert/strict`).
- Use descriptive variable names; follow existing patterns in each file.

## Testing Guidelines

- Framework: Node.js built-in test runner (`node:test`) with `node:assert/strict`.
- Each test creates an isolated temp directory as a fake `$HOME` with `SKILL.md` fixtures.
- CI runs on Node 18/20/22 across Ubuntu and macOS.
- Run `npm test` before every commit — it covers syntax checks, unit tests, and scanner smoke tests.

## Commit & Pull Request Guidelines

- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.
- Branch naming: `feat/your-feature`, `fix/your-fix`.
- PRs must include: summary, test plan (`npm test` passes, manual CLI test), and a constraints checklist (no new deps, `scan-skills.js` stays one file, no network calls in scanner).

## Constraints Checklist

- No new npm dependencies.
- `scan-skills.js` stays one file.
- Scanner reads local files only (no network calls).
- SKILL.md frontmatter follows Claude Code conventions (`name`, `description`, `allowed-tools`).
