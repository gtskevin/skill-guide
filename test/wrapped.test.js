'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'skill-guide.js');

function writeSkill(home, relativeDir, name, description) {
  const dir = path.join(home, relativeDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\ntriggers:\n  - ${name}\n---\n\n# ${name}\n`,
    'utf8'
  );
}

function runCli(home, args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });
}

test('--wrapped generates terminal output with community comparison', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-wrapped-'));
  writeSkill(home, '.claude/skills/test-skill', 'test-skill', 'A test skill for wrapped mode');

  const stdout = runCli(home, ['--wrapped', '--refresh']);

  assert.match(stdout, /Your AI Skill Report|你的 AI 技能报告/);
  assert.match(stdout, /Total Skills|总技能数/);
  assert.match(stdout, /Community Comparison|社区对比/);
  assert.match(stdout, /Skill DNA|技能 DNA/);
  assert.match(stdout, /Share Your Report|分享你的报告/);
  assert.match(stdout, /exceed|超过了/);
});

test('--wrapped generates HTML report', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-wrapped-html-'));
  const output = path.join(home, 'wrapped.html');
  writeSkill(home, '.claude/skills/test-skill', 'test-skill', 'A test skill');

  const stdout = runCli(home, ['--wrapped', '--output', output, '--no-open', '--refresh']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(stdout, /Generated/);
  assert.match(html, /My AI Skill Report|我的 AI 技能报告/);
  assert.match(html, /Community Comparison|社区对比/);
  assert.match(html, /Skill DNA|技能 DNA/);
  assert.match(html, /Copy Share Text|复制分享文案/);
  assert.match(html, /skill-guide/);
});

test('--wrapped shows percentile rankings', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-wrapped-pct-'));
  writeSkill(home, '.claude/skills/skill-a', 'skill-a', 'Skill A');
  writeSkill(home, '.claude/skills/skill-b', 'skill-b', 'Skill B');
  writeSkill(home, '.claude/skills/skill-c', 'skill-c', 'Skill C');

  const stdout = runCli(home, ['--wrapped', '--refresh']);

  assert.match(stdout, /\d+%/);
  assert.match(stdout, /\$15/); // 3 skills * $5
});

test('--wrapped works with multiple categories', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-wrapped-cat-'));
  writeSkill(home, '.claude/skills/security-audit', 'security-audit', 'Security audit skill');
  writeSkill(home, '.claude/skills/tdd-workflow', 'tdd-workflow', 'TDD testing workflow');
  writeSkill(home, '.claude/skills/ui-design', 'ui-design', 'UI design review');

  const stdout = runCli(home, ['--wrapped', '--refresh']);

  assert.match(stdout, /security|testing|design/);
});

test('--wrapped --no-open does not crash', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-wrapped-json-'));
  writeSkill(home, '.claude/skills/test-skill', 'test-skill', 'A test skill');

  const stdout = runCli(home, ['--wrapped', '--refresh', '--no-open']);
  assert.ok(stdout.length > 0);
});
