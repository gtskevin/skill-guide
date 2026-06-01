'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
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

const GOOD_SKILL = `---
name: good-skill
description: A well-documented skill with clear triggers and limitations
triggers:
  - when the user asks about testing
  - TDD workflow
allowed-tools:
  - Bash(npm test:*)
tags:
  - testing
  - quality
---

# Good Skill

## When to Use

Use this skill when the user wants to write tests first, then implement. Good for new features and bug fixes.

## How It Works

1. Write a failing test
2. Make it pass
3. Refactor

## Limitations

Do not use this skill for one-off scripts or throwaway code. Avoid applying TDD to exploratory prototyping.
`;

const MISSING_DESC_SKILL = `---
name: missing-desc
triggers:
  - missing
---

# Missing Description

Short body.
`;

const BROKEN_SKILL = `---
description: no name just desc
---

# Broken

No name, no triggers, no limitations.
`;

test('lint all skills with mixed quality', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-all-'));
  writeSkillFile(home, '.claude/skills/good-skill', GOOD_SKILL);
  writeSkillFile(home, '.claude/skills/missing-desc', MISSING_DESC_SKILL);
  writeSkillFile(home, '.claude/skills/broken-skill', BROKEN_SKILL);

  const stdout = runCli(home, ['--lint', '--format', 'json', '--refresh']);
  const parsed = JSON.parse(stdout);

  assert.equal(parsed.totalChecked, 3);
  assert.ok(parsed.summary.ready >= 1, 'at least one skill should be ready');
  assert.ok(parsed.summary.needsWork >= 1, 'at least one skill needs work');

  const good = parsed.results.find(r => r.name === 'good-skill');
  assert.ok(good, 'good-skill found');
  assert.ok(good.overall >= 70, `good-skill should be ready (got ${good.overall})`);

  const broken = parsed.results.find(r => r.name === 'broken-skill');
  assert.ok(broken, 'broken-skill found');
  assert.ok(broken.overall < good.overall, 'broken-skill should score lower than good-skill');
});

test('lint specific file path', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-file-'));
  const skillPath = path.join(home, 'my-skill');
  writeSkillFile(home, 'my-skill', GOOD_SKILL);

  const stdout = runCli(home, ['--lint', path.join(skillPath, 'SKILL.md'), '--format', 'json']);
  const parsed = JSON.parse(stdout);

  assert.equal(parsed.totalChecked, 1);
  assert.equal(parsed.results[0].name, 'good-skill');
  assert.ok(parsed.results[0].overall >= 70);
});

test('lint missing file exits with error', () => {
  const result = spawnSync(process.execPath, [cli, '--lint', '/nonexistent/path/SKILL.md'], {
    cwd: root,
    env: { ...process.env, HOME: '/tmp' },
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /File not found/);
});

test('lint detects generic triggers', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-generic-'));
  const content = `---
name: generic-trigger-skill
description: A skill with a generic trigger phrase
triggers:
  - use when needed
---

# Generic Trigger
`;
  writeSkillFile(home, '.claude/skills/generic-trigger', content);

  const stdout = runCli(home, ['--lint', '--format', 'json', '--refresh']);
  const parsed = JSON.parse(stdout);

  const skill = parsed.results.find(r => r.name === 'generic-trigger-skill');
  assert.ok(skill, 'skill found');
  const issue = skill.issues.find(i => i.id === 'activ-generic-trigger');
  assert.ok(issue, 'generic trigger issue detected');
});

test('lint detects missing limitations section', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-limits-'));
  const content = `---
name: no-limits-skill
description: A skill without any limitations section documented anywhere
triggers:
  - testing
---

# No Limits

## When to Use

Use this when you need it.

## How It Works

It works well.
`;
  writeSkillFile(home, '.claude/skills/no-limits', content);

  const stdout = runCli(home, ['--lint', '--format', 'json', '--refresh']);
  const parsed = JSON.parse(stdout);

  const skill = parsed.results.find(r => r.name === 'no-limits-skill');
  assert.ok(skill, 'skill found');
  const issue = skill.issues.find(i => i.id === 'scope-no-limits');
  assert.ok(issue, 'missing limitations issue detected');
});

test('lint detects short description', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-short-'));
  const content = `---
name: short-desc-skill
description: Too brief
triggers:
  - short
---

# Short Desc
`;
  writeSkillFile(home, '.claude/skills/short-desc', content);

  const stdout = runCli(home, ['--lint', '--format', 'json', '--refresh']);
  const parsed = JSON.parse(stdout);

  const skill = parsed.results.find(r => r.name === 'short-desc-skill');
  assert.ok(skill, 'skill found');
  const issue = skill.issues.find(i => i.id === 'meta-short-desc');
  assert.ok(issue, 'short description issue detected');
});

test('lint detects broad Bash tool declaration', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-bash-'));
  const content = `---
name: broad-bash-skill
description: A skill that declares Bash without scope restrictions
triggers:
  - automation
allowed-tools:
  - Bash
---

# Broad Bash
`;
  writeSkillFile(home, '.claude/skills/broad-bash', content);

  const stdout = runCli(home, ['--lint', '--format', 'json', '--refresh']);
  const parsed = JSON.parse(stdout);

  const skill = parsed.results.find(r => r.name === 'broad-bash-skill');
  assert.ok(skill, 'skill found');
  const issue = skill.issues.find(i => i.id === 'rev-broad-bash');
  assert.ok(issue, 'broad Bash tool issue detected');
});

test('lint detects security patterns', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-sec-'));
  const content = `---
name: risky-skill
description: Uses eval() and handles api_key values for testing
triggers:
  - risky
---

# Risky

This skill calls eval() to execute code and reads api_key from environment.
`;
  writeSkillFile(home, '.claude/skills/risky', content);

  const stdout = runCli(home, ['--lint', '--format', 'json', '--refresh']);
  const parsed = JSON.parse(stdout);

  const skill = parsed.results.find(r => r.name === 'risky-skill');
  assert.ok(skill, 'skill found');
  const shellIssue = skill.issues.find(i => i.id === 'rev-shell-exec');
  const credIssue = skill.issues.find(i => i.id === 'rev-credentials');
  assert.ok(shellIssue, 'shell execution pattern detected');
  assert.ok(credIssue, 'credential keyword detected');
});

test('lint terminal output contains table and legend', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-term-'));
  writeSkillFile(home, '.claude/skills/good-skill', GOOD_SKILL);

  const stdout = runCli(home, ['--lint', '--refresh']);

  assert.match(stdout, /Review Readiness/);
  assert.match(stdout, /Meta\s+Activ/);
  assert.match(stdout, /Legend/);
  assert.match(stdout, /good-skill/);
});

test('lint YAML leak detection', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-yaml-'));
  const content = `---
name: yaml-leak-skill
description: "--- this starts with YAML dashes by mistake"
triggers:
  - yaml
---

# YAML Leak
`;
  writeSkillFile(home, '.claude/skills/yaml-leak', content);

  const stdout = runCli(home, ['--lint', '--format', 'json', '--refresh']);
  const parsed = JSON.parse(stdout);

  const skill = parsed.results.find(r => r.name === 'yaml-leak-skill');
  assert.ok(skill, 'skill found');
  const issue = skill.issues.find(i => i.id === 'ctx-yaml-leak');
  assert.ok(issue, 'YAML leak detected');
});

test('lint excludes plugin commands/ files', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-cmd-'));
  // Real skill
  writeSkillFile(home, '.claude/skills/real-skill', GOOD_SKILL);
  // Plugin command file (should be excluded)
  const cmdDir = path.join(home, '.claude/plugins/marketplaces/test-plugin/commands');
  fs.mkdirSync(cmdDir, { recursive: true });
  fs.writeFileSync(path.join(cmdDir, 'review.md'), `---
description: A plugin sub-command file
---

Run skill-guide.js --review
`, 'utf8');

  const stdout = runCli(home, ['--lint', '--format', 'json', '--refresh']);
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (e) {
    assert.fail(`Invalid JSON output: ${stdout.slice(0, 500)}`);
  }

  const names = parsed.results.map(r => r.name);
  assert.ok(names.includes('good-skill'), `real skill should be linted, got: ${names.join(', ')}`);
  assert.ok(!names.includes('review'), 'plugin command file should be excluded');
});

test('lint filters by platform (claude only)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-lint-plat-'));
  // Claude skill — should be included
  writeSkillFile(home, '.claude/skills/claude-skill', GOOD_SKILL);
  // Codex skill — should be excluded when CLAUDE_CODE is set
  const codexDir = path.join(home, '.codex/skills/codex-skill');
  fs.mkdirSync(codexDir, { recursive: true });
  fs.writeFileSync(path.join(codexDir, 'SKILL.md'), `---
name: codex-skill
description: A codex-only skill that should be filtered out
triggers:
  - codex
---

# Codex Skill
`, 'utf8');

  const stdout = execFileSync(process.execPath, [cli, '--lint', '--format', 'json', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CODE: '1' },
    encoding: 'utf8',
  });
  const parsed = JSON.parse(stdout);

  const names = parsed.results.map(r => r.name);
  assert.ok(names.includes('good-skill'), `claude skill should be included, got: ${names.join(', ')}`);
  assert.ok(!names.includes('codex-skill'), 'codex skill should be filtered out');
});
