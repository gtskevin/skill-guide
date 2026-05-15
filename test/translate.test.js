'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'skill-guide.js');

function writeSkill(home, relativeDir, name, description, extraBody = '') {
  const dir = path.join(home, relativeDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\ntriggers:\n  - ${name}\n---\n\n# ${name}\n${extraBody}`,
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

test('translates skill description in HTML output when --lang zh', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-zh-'));
  const output = path.join(home, 'guide.html');

  writeSkill(home, '.claude/skills/test-skill', 'test-skill',
    'Run comprehensive security audit with code review and performance optimization');

  runCli(home, ['--refresh', '--lang', 'zh', '--output', output, '--no-open']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(html, /安全审计/);
  assert.match(html, /代码审查/);
  assert.match(html, /性能优化/);
});

test('preserves English text when --lang is not zh', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-en-'));
  const output = path.join(home, 'guide.html');

  writeSkill(home, '.claude/skills/test-skill', 'test-skill',
    'Run comprehensive security audit with code review');

  runCli(home, ['--refresh', '--output', output, '--no-open']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(html, /security audit/);
  assert.match(html, /code review/);
  assert.match(html, /Your Claude Code Skills/);
});

test('translates section titles and summaries in deep-dive mode with --lang zh', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-zh-skill-'));
  const output = path.join(home, 'guide.html');

  writeSkill(home, '.claude/skills/my-skill', 'my-skill',
    'Conduct market research with competitive analysis',
    '\n## When to Use\nUse when you need market sizing or code review.\n');

  runCli(home, ['--refresh', '--skill', 'my-skill', '--lang', 'zh', '--output', output, '--no-open']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(html, /市场调研/);
  assert.match(html, /竞争分析/);
});

test('translates UI labels to Chinese when --lang zh', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-zh-src-'));
  const output = path.join(home, 'guide.html');

  writeSkill(home, '.claude/skills/demo', 'demo', 'A demo skill for testing');

  runCli(home, ['--refresh', '--lang', 'zh', '--output', output, '--no-open']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(html, /个技能已扫描/);
  assert.match(html, /分类概览/);
  assert.match(html, /精选推荐/);
  assert.match(html, /快速参考/);
});
