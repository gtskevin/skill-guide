# Changelog

All notable changes to skill-guide will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-15

### Added
- Deterministic `skill-guide` CLI for direct `npx skill-guide --open` usage.
- `--doctor` diagnostics for Node.js, Codex home, skill counts, and source breakdown.
- `--format json` for raw scanner output from the main CLI.
- GitHub Actions test and Pages workflows.
- Regenerated Agent Skills demo screenshots, demo GIF, and social preview image.
- Codex skill discovery from `~/.codex/skills`, `$CODEX_HOME/skills`, and Codex plugin cache.
- OpenAI/Codex UI metadata in `agents/openai.yaml`.
- Cross-platform Agent Skills positioning and Codex install instructions.
- Scanner tests for Codex sources and cache isolation.
- Scanner tests for multiline descriptions, quoted values, lists, and duplicate source labels.

### Changed
- `SKILL.md` now delegates HTML generation to the deterministic CLI, with the old scanner-driven instructions as fallback.
- Cache files are now scoped to the active scan roots, avoiding stale results when switching between Claude Code and Codex environments.

## [0.1.0] - 2026-05-15

### Added
- `scan-skills.js` — zero-dependency Node.js scanner with 4 modes (`--list`, `--skill`, `--search`, `--full`)
- `SKILL.md` — Claude Code skill definition with HTML generation rules for 4 interaction modes
- Auto-categorization into 9 categories (testing, design, security, documentation, automation, deployment, code-quality, development, other)
- Three-layer data extraction: frontmatter metadata, section summaries, key paragraphs
- 5-minute cache with `--refresh` override
- Symlink-aware directory scanning
- Bilingual output (auto-detect Chinese/English from user input)
- `README.md` with install instructions and architecture overview
- `LICENSE` (MIT)
- `CONTRIBUTING.md`
