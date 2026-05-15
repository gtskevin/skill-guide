'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const scanner = path.join(root, 'scan-skills.js');

function writeSkill(home, relativeDir, name, description, extraFrontmatter = '') {
  const dir = path.join(home, relativeDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n${extraFrontmatter}---\n\n# ${name}\n`,
    'utf8'
  );
}

function runScanner(home, options = {}) {
  const args = options.refresh === false ? [scanner, '--list'] : [scanner, '--refresh', '--list'];
  const output = execFileSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

test('scans Claude and Codex skill directories with distinct source labels', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-home-'));

  writeSkill(home, '.claude/skills/claude-demo', 'claude-demo', 'Claude user skill');
  writeSkill(home, '.codex/skills/codex-demo', 'codex-demo', 'Codex user skill');
  writeSkill(
    home,
    '.codex/plugins/cache/example-plugin/skills/plugin-demo',
    'plugin-demo',
    'Codex plugin skill'
  );

  const result = runScanner(home);
  const byName = new Map(result.skills.map((skill) => [skill.name, skill]));

  assert.equal(result.totalCount, 3);
  assert.deepEqual(byName.get('claude-demo').sources, ['claude-user']);
  assert.deepEqual(byName.get('codex-demo').sources, ['codex-user']);
  assert.deepEqual(byName.get('plugin-demo').sources, ['codex-plugin']);
  assert.equal(result.sources['claude-user'], 1);
  assert.equal(result.sources['codex-user'], 1);
  assert.equal(result.sources['codex-plugin'], 1);
});

test('does not reuse cached scans across different skill roots', () => {
  const firstHome = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-home-a-'));
  const secondHome = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-home-b-'));

  writeSkill(firstHome, '.claude/skills/first-demo', 'first-demo', 'First skill root');
  writeSkill(secondHome, '.codex/skills/second-demo', 'second-demo', 'Second skill root');

  const first = runScanner(firstHome);
  const second = runScanner(secondHome, { refresh: false });

  assert.deepEqual(first.skills.map((skill) => skill.name), ['first-demo']);
  assert.deepEqual(second.skills.map((skill) => skill.name), ['second-demo']);
});

test('parses common frontmatter shapes without dependencies', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-frontmatter-'));
  writeSkill(
    home,
    '.claude/skills/frontmatter-demo',
    '"frontmatter-demo"',
    '|',
    '  Multi-line description for testing.\n  Includes YAML pipe style.\ntriggers:\n  - "quoted trigger"\n  - list trigger\nallowed-tools: [Bash, "Read"]\n'
  );

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.equal(skill.name, 'frontmatter-demo');
  assert.match(skill.description, /Multi-line description/);
  assert.deepEqual(skill.triggers, ['quoted trigger', 'list trigger']);
  assert.deepEqual(skill.allowedTools, ['Bash', 'Read']);
});

test('deduplicates source labels when the same source finds a skill twice', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-dedupe-'));
  writeSkill(home, '.cc-switch/skills/primary-demo', 'dupe-demo', 'Primary duplicate');
  writeSkill(home, '.cc-switch/skills/nested/secondary-demo', 'dupe-demo', 'Nested duplicate');

  const result = runScanner(home);
  const skill = result.skills.find((entry) => entry.name === 'dupe-demo');

  assert.deepEqual(skill.sources, ['cc-switch']);
});

test('labels hidden Codex system skills separately from user skills', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-system-'));
  writeSkill(home, '.codex/skills/.system/system-demo', 'system-demo', 'OpenAI system skill');
  writeSkill(home, '.codex/skills/user-demo', 'user-demo', 'Codex user skill');

  const result = runScanner(home);
  const byName = new Map(result.skills.map((skill) => [skill.name, skill]));

  assert.deepEqual(byName.get('system-demo').sources, ['openai-system']);
  assert.deepEqual(byName.get('user-demo').sources, ['codex-user']);
  assert.equal(result.sources['openai-system'], 1);
  assert.equal(result.sources['codex-user'], 1);
});
