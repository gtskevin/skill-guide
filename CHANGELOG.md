# Changelog

All notable changes to skill-guide will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
