# README Positioning Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present `skill-guide` as a trustworthy local inventory, discovery, and pre-use review tool for Agent Skills.

**Architecture:** Keep runtime behavior unchanged. Update only repository presentation files and GitHub repository metadata. Use a theme-aware SVG banner and a shorter README that distinguishes implemented capabilities from deferred runtime observability and optional LLM review.

**Tech Stack:** Markdown, SVG, GitHub CLI, existing README quality checker, npm test suite.

---

### Task 1: Ignore Visual Brainstorming Artifacts

**Files:**
- Modify: `.gitignore`

- [ ] Add `.superpowers/` under local development artifacts.
- [ ] Run `git check-ignore -v .superpowers/test`.

### Task 2: Add Theme-Aware Hero Banner

**Files:**
- Create: `.github/assets/banner.svg`

- [ ] Add an `800x200` SVG with dark-mode CSS, a benefit-driven subtitle, and three capability pills.
- [ ] Verify the SVG includes `prefers-color-scheme: dark`.

### Task 3: Rewrite README Around User Pain

**Files:**
- Modify: `README.md`

- [ ] Replace the badge wall with four hero badges.
- [ ] Lead with trust-before-use pain points and four highlights.
- [ ] Add a 30-second Quick Start and expected output.
- [ ] Preserve the GIF and screenshots.
- [ ] Add an honest capability boundary table and collapsible FAQ.
- [ ] Keep compact platform, command, architecture, contributing, license, and author sections.

### Task 4: Verify Presentation and Runtime

- [ ] Run `python3 ~/.codex/skills/readme-craft/scripts/quality_check.py README.md --repo-path .`.
- [ ] Run `npm test`.
- [ ] Run `git diff --check`.

### Task 5: Update GitHub Metadata

- [ ] Run:

```bash
gh repo edit gtskevin/skill-guide \
  --description "Inspect, find, and review your installed Agent Skills across Codex and Claude Code." \
  --homepage "https://gtskevin.github.io/skill-guide/"
```

- [ ] Verify with `gh repo view gtskevin/skill-guide --json description,homepageUrl`.
