# Changelog

All notable changes to skill-guide will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-06-02

### Added
- `--overlap` standalone mode: find semantically overlapping skills by triggers, allowed-tools, and tags using Jaccard similarity.
- `--overlap --format json` for machine-readable overlap output.
- `detectOverlaps()` with category-pruned pair-wise comparison (only compares skills in the same category).
- Overlap results integrated into `--review` mode (replaces naive category-count overlap).
- Dashboard cleanup slide now shows semantic overlap cards with severity badges.
- 8 overlap tests: trigger overlap, tool overlap, unrelated skills, empty arrays, category pruning, terminal/JSON output, end-to-end.

### Changed
- `--lint` renamed to `--check` for non-programmer friendliness. `--lint` kept as legacy alias.
- Review brief overlap items now use `type: 'semantic-overlap'` with evidence, context, similarity scores, and action hints.
- Dashboard cleanup slide overlap label changed from "Category overlap" to "Semantic overlap".

## [0.5.0] - 2026-06-01

### Added
- Plugin sub-skill structure: `.claude-plugin/plugin.json` with `commands/` directory exposing 7 modes (dashboard, review, find, recommend, share, doctor, lint) as `skill-guide: <mode>` sub-commands.
- `--check` mode: checks SKILL.md files for Review Readiness across 5 dimensions (Metadata Completeness, Activation Clarity, Scope Clarity, Context Efficiency, Review Priority).
- `--check <path>` for checking a specific SKILL.md file.
- `--check --format json` for machine-readable output.
- `--lint` accepted as legacy alias for `--check`.
- 12 check tests and 4 plugin command structure tests.

### Changed
- SKILL.md simplified to default dashboard mode with sub-command references.
- `parseMode()` updated to recognize `--check` flag and file path argument.

### Backward Compatible
- SKILL.md still works as a standalone skill definition (no plugin required).
- All existing CLI modes (`--doctor`, `--review`, `--find`, `--recommend`, `--share`) unchanged.

## [0.4.0] - 2026-06-01

### Added
- Platform-scoped filtering: all modes (dashboard, doctor, find, review, recommend, share) default to the current agent's skills.
- Auto-detection via env vars (`CLAUDE_CODE`, `CODEX_AGENT`) or install path.
- `--platform <claude|codex>` flag to force a specific platform view.
- `--all` flag to see the full cross-platform inventory.
- `applyPlatformFilter()` helper for consistent platform filtering across all CLI modes.
- 8 new tests covering platform detection, filtering, and env var auto-detection.

### Changed
- Review mode (`--review`) no longer flags cross-agent duplicates as issues — each agent needs its own skill copies.
- Cover slide title auto-adapts to show "Your Claude Code Skills" or "Your Codex Skills" based on filtered results.
- `--find` commands in Next Steps slide simplified (removed redundant `--find` flag).

### Fixed
- `\n` literal rendering in Copy Review Prompt button (replaced inline string with window variable pattern).
- `--platform` value no longer misinterpreted as a positional `--find` argument.

## [0.3.1] - 2026-06-01

### Added
- Local health dashboard with radar chart, token estimate, review prompts, share page, and directory-based recommendations.
- Packaging regression test that installs the generated npm tarball and starts the installed CLI.
- Skill-definition regression test that keeps the agent entrypoint concise and trigger-first.

### Changed
- Health output now describes local metadata heuristics instead of unsupported community percentile comparisons.
- Recommendation and cleanup wording now requires manual review before installing, editing, or deleting skills.
- `SKILL.md` is now a thin CLI wrapper with English and Chinese dashboard support.
- Online directory fetching now invokes `curl` directly without an unnecessary shell wrapper.

### Fixed
- Added `skill-registry.js` to the npm package so installed `0.3.x` CLI commands can start.

### Removed
- Tracked local agent settings and browser debug artifacts.

## [0.3.0] - 2026-05-28

Repository-only development version. It was not published to npm.

### Added
- Initial health dashboard, recommendation registry, share page, and personal profile experiments.

## [0.2.1] - 2026-05-17

### Fixed
- `--skill <name>` now resolves shorthand skill names such as `tdd` to the best matching installed skill, preferring name prefixes like `tdd-workflow`.
- Missing skill lookups in HTML mode now print a terminal error and exit without generating an empty HTML guide.
- Missing skill JSON output now preserves scan counts, source counts, and close-match suggestions.

## [0.2.0] - 2026-05-15

### Added
- Deterministic `skill-guide` CLI for direct `npx skill-guide --open` usage.
- `--doctor` diagnostics for Node.js, Codex home, skill counts, and source breakdown.
- `--format json` for raw scanner output from the main CLI.
- `--lang zh` built-in Chinese UI labels with `LABELS.zh` map.
- Built-in English and Chinese dashboard labels.
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
- Chinese dashboard labels can be selected with `--lang zh`.

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
