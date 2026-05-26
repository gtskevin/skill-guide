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

test('--recommend outputs recommendation report', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-recommend-'));
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');

  const stdout = execFileSync(process.execPath, [cli, '--recommend', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), SKILL_REGISTRY_OFFLINE: '1' },
    encoding: 'utf8',
  });

  assert.match(stdout, /skill-guide recommend/);
  assert.match(stdout, /Your skill stack/);
});

test('--recommend --open generates HTML report', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-recommend-html-'));
  const output = path.join(home, 'recommend.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');

  execFileSync(process.execPath, [cli, '--recommend', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), SKILL_REGISTRY_OFFLINE: '1' },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');
  assert.match(html, /Skill Recommendations/);
  assert.match(html, /Stop guessing/);
  assert.match(html, /npx skill-guide/);
});

test('--share generates a standalone portfolio HTML', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-share-'));
  const output = path.join(home, 'share.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/debug', 'debug', 'Systematic debugging');
  writeSkill(home, '.claude/skills/security-audit', 'security-audit', 'OWASP security scanning');

  execFileSync(process.execPath, [cli, '--share', '--output', output, '--no-open', '--refresh', '--user', '@testuser'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');
  assert.match(html, /My AI Skill Stack/);
  assert.match(html, /Shared by @testuser/);
  assert.match(html, /Stop guessing/);
  assert.match(html, /npx skill-guide --open/);
  assert.match(html, /tdd/);
  assert.match(html, /debug/);
  assert.match(html, /security-audit/);
  assert.match(html, /og:title/);
});

test('share HTML output contains persona section', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-persona-'));
  const output = path.join(home, 'share.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/debug', 'debug', 'Systematic debugging');
  writeSkill(home, '.claude/skills/security-audit', 'security-audit', 'OWASP security scanning');

  execFileSync(process.execPath, [cli, '--share', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');
  assert.ok(html.includes('persona'), 'should contain persona section');
  assert.ok(html.includes('Developer') || html.includes('Engineer') || html.includes('Builder') || html.includes('Explorer') || html.includes('Collector') || html.includes('Champion'), 'should contain a persona label');
});

test('share HTML contains SVG radar chart', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-radar-'));
  const output = path.join(home, 'share.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/debug', 'debug', 'Systematic debugging');

  execFileSync(process.execPath, [cli, '--share', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');
  assert.ok(html.includes('<svg'), 'should contain SVG element');
  assert.ok(html.includes('polygon'), 'should contain polygon elements for radar chart');
});

test('--share works without --user flag', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-share-nouser-'));
  const output = path.join(home, 'share.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');

  execFileSync(process.execPath, [cli, '--share', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');
  assert.match(html, /My AI Skill Stack/);
  assert.doesNotMatch(html, /Shared by/);
});

test('share HTML contains all enhanced sections', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-share-final-'));
  const output = path.join(home, 'share.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/debug', 'debug', 'Systematic debugging');
  writeSkill(home, '.claude/skills/security-audit', 'security-audit', 'OWASP security scanning');

  execFileSync(process.execPath, [cli, '--share', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');
  // Core structure
  assert.ok(html.includes('<!DOCTYPE html>'), 'valid HTML');
  assert.ok(html.includes('og:title'), 'has OG tags');
  // Enhanced features
  assert.ok(html.includes('persona'), 'has persona section');
  assert.ok(html.includes('<svg'), 'has radar chart');
  assert.ok(html.includes('polygon'), 'has radar chart polygons');
  assert.ok(html.includes('Stop guessing'), 'has enhanced CTA');
  assert.ok(html.includes('cta-btn'), 'has gradient CTA button');
});

test('share page has pain-point hero and capability map', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-share-hero-'));
  const output = path.join(home, 'share.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/security-audit', 'security-audit', 'OWASP security scanning');
  writeSkill(home, '.claude/skills/debug', 'debug', 'Systematic debugging');

  execFileSync(process.execPath, [cli, '--share', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');

  // Pain-point headline (dynamic: "Scattered skills, no idea what you have?" for <100 skills)
  assert.ok(html.includes('no idea'), 'should have pain-point headline');
  // Capability map section
  assert.ok(html.includes('Capability Map'), 'should have capability map section');
  // OG tags with persona
  assert.ok(html.includes('og:title'), 'should have OG title');
  assert.ok(html.includes('AI Skills'), 'OG title should mention AI Skills');
});

test('recommend page shows completeness scores in overlap', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-recommend-completeness-'));
  const output = path.join(home, 'recommend.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/qa', 'qa', 'Quality Assurance test');
  writeSkill(home, '.claude/skills/e2e', 'e2e', 'End-to-end test');

  execFileSync(process.execPath, [cli, '--recommend', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), SKILL_REGISTRY_OFFLINE: '1' },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');
  assert.ok(html.includes('/100'), 'should show completeness scores');
  assert.ok(html.includes('documentation completeness'), 'should label as documentation completeness');
});

test('recommend HTML contains all enhanced sections', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-recommend-final-'));
  const output = path.join(home, 'recommend.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');

  execFileSync(process.execPath, [cli, '--recommend', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), SKILL_REGISTRY_OFFLINE: '1' },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');
  assert.ok(html.includes('<!DOCTYPE html>'), 'valid HTML');
  assert.ok(html.includes('og:title'), 'has OG tags');
  assert.ok(html.includes('Stop guessing'), 'has enhanced CTA');
  assert.ok(html.includes('breakdown-bar'), 'has category breakdown bar');
  assert.ok(html.includes('breakdown-legend'), 'has breakdown legend');
});

test('full pipeline: share page has all redesigned sections', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-full-pipeline-'));
  const output = path.join(home, 'share.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/security-audit', 'security-audit', 'OWASP security scanning');
  writeSkill(home, '.claude/skills/debug', 'debug', 'Systematic debugging');
  writeSkill(home, '.claude/skills/design-critique', 'design-critique', 'Design feedback');

  execFileSync(process.execPath, [cli, '--share', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');

  // Pain-point headline (dynamic: "Scattered skills, no idea what you have?" for <100 skills)
  assert.ok(html.includes('no idea'), 'pain-point headline');
  // Capability map
  assert.ok(html.includes('Capability Map'), 'capability map section');
  // Stack insights
  assert.ok(html.includes('Strongest'), 'stack insights - strongest');
  // OG tags with persona
  assert.ok(html.includes('og:title'), 'OG title');
  assert.ok(html.includes('AI Skills'), 'OG title mentions AI Skills');
  // Radar chart
  assert.ok(html.includes('<svg'), 'radar chart');
  // CTA
  assert.ok(html.includes('npx skill-guide'), 'CTA command');
  assert.ok(html.includes('cta-btn'), 'CTA button');
});

test('full pipeline: recommend page has completeness scores', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-recommend-full-'));
  const output = path.join(home, 'recommend.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/qa', 'qa', 'Quality Assurance test');
  writeSkill(home, '.claude/skills/e2e', 'e2e', 'End-to-end test');

  execFileSync(process.execPath, [cli, '--recommend', '--output', output, '--no-open', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), SKILL_REGISTRY_OFFLINE: '1' },
    encoding: 'utf8',
  });

  const html = fs.readFileSync(output, 'utf8');

  // Stack overview
  assert.ok(html.includes('Strongest'), 'stack overview - strongest');
  // Overlap with completeness
  assert.ok(html.includes('/100'), 'completeness scores');
  assert.ok(html.includes('documentation completeness'), 'accuracy label');
  // Breakdown bar
  assert.ok(html.includes('breakdown-bar'), 'breakdown bar');
  // CTA
  assert.ok(html.includes('npx skill-guide'), 'CTA command');
});
