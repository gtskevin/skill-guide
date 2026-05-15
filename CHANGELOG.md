# Changelog

All notable changes to skill-guide will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-15

### Added
- Deterministic `skill-guide` CLI for direct `npx skill-guide --open` usage.
- `--doctor` diagnostics for Node.js, Codex home, skill counts, and source breakdown.
- `--format json` for raw scanner output from the main CLI.
- `--lang zh` built-in Chinese UI labels with `LABELS.zh` map.
- Agent-side full translation for any language (ja, ko, fr, de, es, etc.) — SKILL.md workflow step 6.
- Language auto-detection from user input (Chinese, Japanese, Korean, and others).
- Markdown rendering in HTML output with smart truncation for long sections.
- `data-i18n` attributes on all translatable HTML elements.
- GitHub Actions test and Pages workflows.
- Regenerated Agent Skills demo screenshots, demo GIF, and social preview image.
- Codex skill discovery from `~/.codex/skills`, `$CODEX_HOME/skills`, and Codex plugin cache.
- OpenAI/Codex UI metadata in `agents/openai.yaml`.
- Cross-platform Agent Skills positioning and Codex install instructions.
- Scanner tests for Codex sources and cache isolation.
- Scanner tests for multiline descriptions, quoted values, lists, and duplicate source labels.
- Translation tests: Chinese label rendering, English preservation, section/summary translation.

### Changed
- `SKILL.md` now delegates HTML generation to the deterministic CLI, with the old scanner-driven instructions as fallback.
- Cache files are now scoped to the active scan roots, avoiding stale results when switching between Claude Code and Codex environments.
- Translation generalized from Chinese-only to any language — agent translates both `data-i18n` content and plain text.

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
