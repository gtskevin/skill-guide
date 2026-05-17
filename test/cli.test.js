'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
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

test('generates a deterministic HTML guide from Claude and Codex skills', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-cli-home-'));
  const output = path.join(home, 'guide.html');

  writeSkill(home, '.claude/skills/claude-demo', 'claude-demo', 'Claude demo skill');
  writeSkill(home, '.codex/skills/codex-demo', 'codex-demo', 'Codex demo skill');

  const stdout = runCli(home, ['--refresh', '--output', output, '--no-open']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(stdout, /Generated/);
  assert.match(html, /Your Agent Skills/);
  assert.match(html, /claude-demo/);
  assert.match(html, /codex-demo/);
  assert.match(html, /scroll-snap-type/);
});

test('prints doctor diagnostics for scanned skill roots', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-doctor-home-'));
  writeSkill(home, '.codex/skills/codex-demo', 'codex-demo', 'Codex demo skill');
  writeSkill(home, '.claude/skills/codex-demo-copy', 'codex-demo', 'Duplicate skill name');
  const malformedDir = path.join(home, '.claude/skills/broken-skill');
  fs.mkdirSync(malformedDir, { recursive: true });
  fs.writeFileSync(path.join(malformedDir, 'SKILL.md'), '# Missing frontmatter\n', 'utf8');

  const stdout = runCli(home, ['--doctor', '--refresh']);

  assert.match(stdout, /Skill Guide Doctor/);
  assert.match(stdout, /Node\.js/);
  assert.match(stdout, /codex-user/);
  assert.match(stdout, /Claude Code skills path: exists/);
  assert.match(stdout, /Codex skills path: exists/);
  assert.match(stdout, /Total skills: 1/);
  assert.match(stdout, /Duplicate skill names: 1/);
  assert.match(stdout, /Malformed skill files: 1/);
  assert.match(stdout, /Suggested Codex install/);
});

test('prints scanner JSON when requested', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-json-home-'));
  writeSkill(home, '.codex/skills/codex-demo', 'codex-demo', 'Codex demo skill');

  const stdout = runCli(home, ['--refresh', '--format', 'json']);
  const parsed = JSON.parse(stdout);

  assert.equal(parsed.totalCount, 1);
  assert.equal(parsed.skills[0].name, 'codex-demo');
});

test('generates a shorthand skill deep dive without an empty cover', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-shorthand-html-'));
  const output = path.join(home, 'guide.html');
  writeSkill(home, '.claude/skills/django-tdd', 'django-tdd', 'Django TDD skill');
  writeSkill(home, '.claude/skills/tdd-workflow', 'tdd-workflow', 'General TDD workflow skill');

  runCli(home, ['--refresh', '--skill', 'tdd', '--output', output, '--no-open']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(html, /2 skills scanned/);
  assert.match(html, /tdd-workflow/);
  assert.doesNotMatch(html, /0 skills scanned/);
  assert.doesNotMatch(html, /No skill sources found/);
});

test('prints a terminal error instead of generating HTML when a skill is not found', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-missing-html-'));
  const output = path.join(home, 'missing.html');
  writeSkill(home, '.claude/skills/tdd-workflow', 'tdd-workflow', 'General TDD workflow skill');

  const result = spawnSync(process.execPath, [
    cli,
    '--refresh',
    '--skill',
    'definitely-missing',
    '--output',
    output,
    '--no-open',
  ], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Skill "definitely-missing" not found/);
  assert.match(result.stderr, /Scanned 1 skills/);
  assert.equal(fs.existsSync(output), false);
});
