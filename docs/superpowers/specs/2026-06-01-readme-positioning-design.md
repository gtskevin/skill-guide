# README Positioning Refresh Design

**Status:** Approved

## Decision

Refresh the repository presentation without adding optional LLM review in this iteration. LLM review is valuable, but it requires a separate product design covering model access, privacy, evidence, confidence, cost, and human confirmation.

## Product Positioning

`skill-guide` is a local inventory, discovery, and pre-use review tool for Agent Skills. It helps users reduce uncertainty before trusting a downloaded Skill:

- See which Skills are installed across Codex, Claude Code, cc-switch, and plugin directories.
- Find whether an existing Skill may fit a task.
- Inspect a Skill's source, description, triggers, declared tools, use cases, limitations, and document structure.
- Review local metadata signals such as sparse descriptions, duplicate sources, and estimated description tokens.

The README must not claim that the tool tracks whether a Skill was actually invoked, measures runtime token usage, evaluates result quality, or proves that a Skill is safe.

## README Structure

1. Theme-aware banner and four hero badges.
2. Pain-point-led introduction for developers, including non-technical users.
3. Four highlights: inventory, task search, deep inspection, pre-use review.
4. Thirty-second Quick Start with expected output.
5. Demo GIF and dashboard screenshots.
6. Explicit capability boundary table.
7. Compact usage reference, platform support, and architecture.
8. FAQ, contributing link, license, and author footer.

## Repository Metadata

- GitHub About: `Inspect, find, and review your installed Agent Skills across Codex and Claude Code.`
- Homepage: `https://gtskevin.github.io/skill-guide/`

## Deferred AI-Native Feature

A future optional LLM review should accept selected Skill documents and return structured judgments with source evidence, confidence, estimated call cost, and human confirmation before any consequential action. Runtime invocation tracking and actual cost measurement require separate logging integrations.
