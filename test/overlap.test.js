'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'skill-guide.js');

function writeSkillFile(home, relativeDir, content) {
  const dir = path.join(home, relativeDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8');
}

function runCli(home, args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });
}

const SKILL_A = `---
name: code-review
description: Review code for quality and security issues
triggers:
  - review code
  - code quality
  - security review
allowed-tools:
  - Bash(npm test:*)
  - Read
tags:
  - review
  - quality
  - security
---

# Code Review
`;

const SKILL_B = `---
name: security-review
description: Review code for security vulnerabilities
triggers:
  - security review
  - vulnerability scan
  - review code
allowed-tools:
  - Bash(npm test:*)
  - Read
tags:
  - review
  - security
---

# Security Review
`;

const UNRELATED_SKILL = `---
name: frontend-design
description: Design frontend components and layouts
triggers:
  - UI design
  - frontend
allowed-tools:
  - Write
tags:
  - design
---

# Frontend Design
`;

test('detects high trigger overlap', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-ovl-'));
  writeSkillFile(home, '.claude/skills/code-review', SKILL_A);
  writeSkillFile(home, '.claude/skills/security-review', SKILL_B);

  const stdout = runCli(home, ['--overlap', '--format', 'json']);
  const parsed = JSON.parse(stdout);

  assert.ok(parsed.totalOverlaps >= 1, 'should find at least 1 overlap');
  const triggerOverlap = parsed.results.find(r => r.dimension === 'triggers');
  assert.ok(triggerOverlap, 'should find trigger overlap');
  assert.ok(triggerOverlap.similarity >= 0.5, `trigger similarity should be >= 0.5, got ${triggerOverlap.similarity}`);
});

test('detects tool overlap', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-ovl-tool-'));
  writeSkillFile(home, '.claude/skills/code-review', SKILL_A);
  writeSkillFile(home, '.claude/skills/security-review', SKILL_B);

  const stdout = runCli(home, ['--overlap', '--format', 'json']);
  const parsed = JSON.parse(stdout);

  const toolOverlap = parsed.results.find(r => r.dimension === 'allowedTools');
  assert.ok(toolOverlap, 'should find tool overlap');
  assert.ok(toolOverlap.similarity >= 0.6, `tool similarity should be >= 0.6, got ${toolOverlap.similarity}`);
});

test('no overlap for unrelated skills', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-ovl-none-'));
  writeSkillFile(home, '.claude/skills/code-review', SKILL_A);
  writeSkillFile(home, '.claude/skills/frontend-design', UNRELATED_SKILL);

  const stdout = runCli(home, ['--overlap', '--format', 'json']);
  const parsed = JSON.parse(stdout);

  assert.equal(parsed.totalOverlaps, 0, 'unrelated skills should have no overlaps');
});

test('empty arrays do not cause false positives', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-ovl-empty-'));
  const noMeta = `---
name: no-meta-skill
description: A skill with no triggers or tools
---

# No Meta
`;
  const alsoNoMeta = `---
name: also-no-meta
description: Another skill with no triggers or tools
---

# Also No Meta
`;
  writeSkillFile(home, '.claude/skills/no-meta', noMeta);
  writeSkillFile(home, '.claude/skills/also-no-meta', alsoNoMeta);

  const stdout = runCli(home, ['--overlap', '--format', 'json']);
  const parsed = JSON.parse(stdout);

  assert.equal(parsed.totalOverlaps, 0, 'empty arrays should not produce overlaps');
});

test('category pruning skips cross-category pairs', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-ovl-cat-'));
  const testingSkill = `---
name: test-runner
description: Run automated tests
triggers:
  - run tests
  - test runner
tags:
  - testing
---

# Test Runner
`;
  const deploySkill = `---
name: deploy-tool
description: Deploy applications to production
triggers:
  - deploy
  - release
tags:
  - deployment
---

# Deploy Tool
`;
  writeSkillFile(home, '.claude/skills/test-runner', testingSkill);
  writeSkillFile(home, '.claude/skills/deploy-tool', deploySkill);

  const stdout = runCli(home, ['--overlap', '--format', 'json']);
  const parsed = JSON.parse(stdout);

  assert.equal(parsed.totalOverlaps, 0, 'skills in different categories should not be compared');
});

test('overlap terminal output format', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-ovl-term-'));
  writeSkillFile(home, '.claude/skills/code-review', SKILL_A);
  writeSkillFile(home, '.claude/skills/security-review', SKILL_B);

  const stdout = runCli(home, ['--overlap', '--refresh']);

  assert.match(stdout, /overlap/);
  assert.match(stdout, /code-review/);
  assert.match(stdout, /security-review/);
});

test('overlap JSON output has correct structure', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-ovl-json-'));
  writeSkillFile(home, '.claude/skills/code-review', SKILL_A);
  writeSkillFile(home, '.claude/skills/security-review', SKILL_B);

  const stdout = runCli(home, ['--overlap', '--format', 'json']);
  const parsed = JSON.parse(stdout);

  assert.ok(typeof parsed.generatedAt === 'string');
  assert.ok(typeof parsed.totalOverlaps === 'number');
  assert.ok(parsed.summary);
  assert.ok(typeof parsed.summary.high === 'number');
  assert.ok(typeof parsed.summary.medium === 'number');
  assert.ok(Array.isArray(parsed.results));
});

test('overlap standalone mode works end-to-end', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-ovl-e2e-'));
  writeSkillFile(home, '.claude/skills/code-review', SKILL_A);
  writeSkillFile(home, '.claude/skills/security-review', SKILL_B);
  writeSkillFile(home, '.claude/skills/frontend-design', UNRELATED_SKILL);

  const stdout = runCli(home, ['--overlap', '--format', 'json', '--refresh']);
  const parsed = JSON.parse(stdout);

  assert.ok(parsed.totalOverlaps >= 1, 'should find overlaps between related skills');
  const allSkills = parsed.results.flatMap(r => r.skills);
  assert.ok(!allSkills.includes('frontend-design'), 'frontend-design should not appear in overlaps');
});
