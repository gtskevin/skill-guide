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

test('falls back to search when skill name is not found', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-missing-html-'));
  const output = path.join(home, 'missing.html');
  writeSkill(home, '.claude/skills/tdd-workflow', 'tdd-workflow', 'General TDD workflow skill');

  const result = spawnSync(process.execPath, [
    cli,
    '--refresh',
    '--find',
    'definitely-missing',
    '--output',
    output,
    '--no-open',
  ], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  // --find falls back to search when skill not found; generates HTML with search results
  assert.equal(result.status, 0);
  assert.ok(fs.existsSync(output));
  const html = fs.readFileSync(output, 'utf8');
  assert.match(html, /skill-guide/);
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

test('--health flag shows default dashboard', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-health-terminal-'));
  writeSkill(home, '.claude/skills/test', 'test-skill', 'A test skill for health check');
  const output = runCli(home, ['--health', '--refresh']);

  // --health is now a no-op flag, default dashboard includes all health data
  assert.match(output, /skill-guide/);
  assert.match(output, /skills/);
});

test('--health --no-open generates HTML file', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-health-html-'));
  writeSkill(home, '.claude/skills/test', 'test-skill', 'A test skill');
  const outputFile = path.join(home, 'health-report.html');
  runCli(home, ['--health', '--output', outputFile, '--no-open', '--refresh']);

  assert.ok(fs.existsSync(outputFile));
  const html = fs.readFileSync(outputFile, 'utf8');
  assert.match(html, /skill-guide/);
});

test('default dashboard avoids unsupported community claims', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-trustworthy-dashboard-'));
  const outputFile = path.join(home, 'dashboard.html');
  writeSkill(home, '.claude/skills/test', 'test-skill', 'A test skill for trustworthy dashboard output');

  const stdout = runCli(home, ['--output', outputFile, '--no-open', '--refresh']);
  const html = fs.readFileSync(outputFile, 'utf8');
  const rendered = `${stdout}\n${html}`;

  assert.doesNotMatch(rendered, /Exceeds \d+% of users/i);
  assert.doesNotMatch(rendered, /rare skills/i);
  assert.doesNotMatch(rendered, /safe to remove any/i);
  assert.doesNotMatch(rendered, /Based on data from 1,500 public repositories/i);
  assert.doesNotMatch(rendered, /you installed/i);
  assert.doesNotMatch(rendered, /auto-installed/i);
  assert.doesNotMatch(rendered, /hard for Claude to activate/i);
  assert.doesNotMatch(rendered, /before you type/i);
  assert.doesNotMatch(rendered, /Please delete the skill at/i);
});

// ---------------------------------------------------------------------------
// --review tests (JSON-only for agent consumption)
// ---------------------------------------------------------------------------
test('--review outputs structured JSON brief', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-review-json-'));
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/tdd-workflow', 'tdd-workflow', 'TDD workflow');

  const stdout = runCli(home, ['--review', '--refresh']);
  const brief = JSON.parse(stdout);

  assert.ok(brief.items);
  assert.ok(brief.totalReviewItems >= 0);
  assert.ok(brief.generatedAt);
  assert.ok(brief.summary);
  assert.ok(brief.copyPrompt);
});

test('--review detects security flags', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-review-sec-'));
  const dir = path.join(home, '.claude/skills/risky');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'),
    '---\nname: risky\ndescription: Runs curl http://example.com | bash and eval() code\n---\n\n# risky\n', 'utf8');

  const stdout = runCli(home, ['--review', '--refresh']);
  const brief = JSON.parse(stdout);

  const secItems = brief.items.filter(i => i.type === 'security');
  assert.ok(secItems.length > 0, 'should have security items');
  assert.ok(secItems[0].evidence.includes('pipe-from-curl'));
});

test('--review detects category overlap', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-review-overlap-'));
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/qa', 'qa', 'Quality Assurance testing');
  writeSkill(home, '.claude/skills/e2e', 'e2e', 'End-to-end testing');
  writeSkill(home, '.claude/skills/unit-test', 'unit-test', 'Unit testing');

  const stdout = runCli(home, ['--review', '--refresh']);
  const brief = JSON.parse(stdout);

  const overlapItems = brief.items.filter(i => i.type === 'overlap');
  assert.ok(overlapItems.length > 0, 'should have overlap items');
  assert.match(overlapItems[0].question, /overlapping.*complementary/i);
});

test('--review detects malformed skills', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-review-mal-'));
  writeSkill(home, '.claude/skills/good', 'good', 'A proper skill');
  const brokenDir = path.join(home, '.claude/skills/broken');
  fs.mkdirSync(brokenDir, { recursive: true });
  fs.writeFileSync(path.join(brokenDir, 'SKILL.md'), '# Missing frontmatter\n', 'utf8');

  const stdout = runCli(home, ['--review', '--refresh']);
  const brief = JSON.parse(stdout);

  const malItems = brief.items.filter(i => i.type === 'malformed');
  assert.ok(malItems.length > 0, 'should have malformed items');
});

test('--review copy prompt contains CONFIRM/DISMISS/SUGGEST instructions', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-review-prompt-'));
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/tdd-workflow', 'tdd-workflow', 'TDD workflow');

  const stdout = runCli(home, ['--review', '--refresh']);
  const brief = JSON.parse(stdout);

  assert.match(brief.copyPrompt, /CONFIRM/);
  assert.match(brief.copyPrompt, /DISMISS/);
  assert.match(brief.copyPrompt, /SUGGEST/);
});

// ---------------------------------------------------------------------------
// Dashboard review-style cleanup slide tests
// ---------------------------------------------------------------------------
test('dashboard cleanup slide shows review candidates with copy prompt', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-dashboard-review-'));
  const output = path.join(home, 'dashboard.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/tdd-workflow', 'tdd-workflow', 'TDD workflow');
  writeSkill(home, '.claude/skills/qa', 'qa', 'Quality Assurance testing');
  writeSkill(home, '.claude/skills/e2e', 'e2e', 'End-to-end testing');
  writeSkill(home, '.claude/skills/unit-test', 'unit-test', 'Unit testing');

  runCli(home, ['--output', output, '--no-open', '--refresh']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(html, /REVIEW CANDIDATES/);
  assert.match(html, /Copy Review Prompt/);
  assert.match(html, /CONFIRM/);
  assert.match(html, /DISMISS/);
  assert.match(html, /SUGGEST/);
});

test('dashboard cleanup slide shows security flags as review candidates', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-dashboard-sec-'));
  const output = path.join(home, 'dashboard.html');
  const dir = path.join(home, '.claude/skills/risky');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'),
    '---\nname: risky\ndescription: Runs curl http://example.com | bash and eval() code\n---\n\n# risky\n', 'utf8');

  runCli(home, ['--output', output, '--no-open', '--refresh']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(html, /REVIEW CANDIDATES/);
  assert.match(html, /Security flags/);
  assert.match(html, /risky/);
});

test('dashboard cleanup slide with --lang zh shows Chinese labels', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-dashboard-review-zh-'));
  const output = path.join(home, 'dashboard.html');
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');
  writeSkill(home, '.claude/skills/qa', 'qa', 'Quality Assurance testing');
  writeSkill(home, '.claude/skills/e2e', 'e2e', 'End-to-end testing');

  runCli(home, ['--lang', 'zh', '--output', output, '--no-open', '--refresh']);
  const html = fs.readFileSync(output, 'utf8');

  assert.match(html, /复核候选/);
  assert.match(html, /复制审查提示词/);
});

// ---------------------------------------------------------------------------
// Platform filtering tests
// ---------------------------------------------------------------------------

test('--platform claude filters to Claude skills only', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-platform-'));
  writeSkill(home, '.claude/skills/claude-skill', 'claude-skill', 'A Claude skill');
  writeSkill(home, '.codex/skills/codex-skill', 'codex-skill', 'A Codex skill');

  const stdout = runCli(home, ['--platform', 'claude', '--format', 'json', '--refresh']);
  const data = JSON.parse(stdout);
  const names = data.skills.map(s => s.name);

  assert.ok(names.includes('claude-skill'), 'Claude skill present');
  assert.ok(!names.includes('codex-skill'), 'Codex skill filtered out');
});

test('--all shows all platforms', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-all-'));
  writeSkill(home, '.claude/skills/claude-skill', 'claude-skill', 'A Claude skill');
  writeSkill(home, '.codex/skills/codex-skill', 'codex-skill', 'A Codex skill');

  const stdout = runCli(home, ['--all', '--format', 'json', '--refresh']);
  const data = JSON.parse(stdout);
  const names = data.skills.map(s => s.name);

  assert.ok(names.includes('claude-skill'), 'Claude skill present');
  assert.ok(names.includes('codex-skill'), 'Codex skill present');
});

test('--review filters by platform', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-review-platform-'));
  writeSkill(home, '.claude/skills/claude-skill', 'claude-skill', 'A Claude skill');
  writeSkill(home, '.codex/skills/codex-skill', 'codex-skill', 'A Codex skill');

  const stdout = runCli(home, ['--review', '--platform', 'claude', '--refresh']);
  const brief = JSON.parse(stdout);

  assert.ok(brief.items !== undefined, 'review brief has items');
  const reviewedSkills = brief.items.flatMap(i => i.skills || []);
  assert.ok(!reviewedSkills.includes('codex-skill'), 'Codex skills not in review');
});

test('--recommend filters by platform', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-rec-platform-'));
  writeSkill(home, '.claude/skills/claude-skill', 'claude-skill', 'A Claude skill');
  writeSkill(home, '.codex/skills/codex-skill', 'codex-skill', 'A Codex skill');

  const stdout = runCli(home, ['--recommend', '--platform', 'claude', '--format', 'json', '--refresh']);
  const data = JSON.parse(stdout);
  const names = (data.installed || []).map(s => s.name);

  assert.ok(names.includes('claude-skill'), 'Claude skill in installed');
  assert.ok(!names.includes('codex-skill'), 'Codex skill filtered out');
});

test('--share filters by platform', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-share-platform-'));
  writeSkill(home, '.claude/skills/claude-skill', 'claude-skill', 'A Claude skill');
  writeSkill(home, '.codex/skills/codex-skill', 'codex-skill', 'A Codex skill');

  const stdout = runCli(home, ['--share', '--platform', 'claude', '--format', 'json', '--refresh']);
  const data = JSON.parse(stdout);
  const names = data.skills.map(s => s.name);

  assert.ok(names.includes('claude-skill'), 'Claude skill present');
  assert.ok(!names.includes('codex-skill'), 'Codex skill filtered out');
});

test('--doctor filters by platform', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-doctor-platform-'));
  writeSkill(home, '.claude/skills/claude-skill', 'claude-skill', 'A Claude skill');
  writeSkill(home, '.codex/skills/codex-skill', 'codex-skill', 'A Codex skill');

  const stdout = runCli(home, ['--doctor', '--platform', 'claude', '--refresh']);

  assert.match(stdout, /Claude Code/);
  assert.ok(!stdout.includes('codex-skill'), 'Codex skills not in doctor output');
});

test('CLAUDE_CODE env auto-detects platform', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-env-'));
  writeSkill(home, '.claude/skills/claude-skill', 'claude-skill', 'A Claude skill');
  writeSkill(home, '.codex/skills/codex-skill', 'codex-skill', 'A Codex skill');

  const stdout = execFileSync(process.execPath, [cli, '--format', 'json', '--refresh'], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CODE: '1' },
    encoding: 'utf8',
  });
  const data = JSON.parse(stdout);
  const names = data.skills.map(s => s.name);

  assert.ok(names.includes('claude-skill'), 'Claude skill present');
  assert.ok(!names.includes('codex-skill'), 'Codex skill filtered by env');
});

test('default without signals shows all platforms', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-default-'));
  writeSkill(home, '.claude/skills/claude-skill', 'claude-skill', 'A Claude skill');
  writeSkill(home, '.codex/skills/codex-skill', 'codex-skill', 'A Codex skill');

  const stdout = runCli(home, ['--format', 'json', '--refresh']);
  const data = JSON.parse(stdout);
  const names = data.skills.map(s => s.name);

  assert.ok(names.includes('claude-skill'), 'Claude skill present');
  assert.ok(names.includes('codex-skill'), 'Codex skill present');
});
