'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('cache key is deterministic for same URLs', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const key1 = registry._cacheKey(['https://example.com/a']);
  const key2 = registry._cacheKey(['https://example.com/a']);
  assert.equal(key1, key2);
  assert.match(key1, /^[a-f0-9]{12}$/);
});

test('cache key differs for different URLs', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const key1 = registry._cacheKey(['https://example.com/a']);
  const key2 = registry._cacheKey(['https://example.com/b']);
  assert.notEqual(key1, key2);
});

test('writeCache and readCache round-trip', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const testData = { entries: [{ name: 'test', description: 'A test skill' }] };
  registry._writeCache(testData, ['https://example.com/test']);
  const loaded = registry._readCache(['https://example.com/test']);
  assert.ok(loaded);
  assert.deepEqual(loaded.entries, testData.entries);
});

test('readCache returns null when expired', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const testData = { entries: [] };
  registry._writeCache(testData, ['https://example.com/expired']);
  const key = registry._cacheKey(['https://example.com/expired']);
  const cacheFile = path.join(os.tmpdir(), 'claude', `skill-registry-${key}.json`);
  const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  raw._ts = Date.now() - 2 * 60 * 60 * 1000;
  fs.writeFileSync(cacheFile, JSON.stringify(raw), 'utf8');
  const loaded = registry._readCache(['https://example.com/expired']);
  assert.equal(loaded, null);
});

test('clearCache removes cache file', () => {
  const registry = require(path.join(root, 'skill-registry'));
  registry._writeCache({ entries: [] }, ['https://example.com/clear']);
  registry.clearCache(['https://example.com/clear']);
  const loaded = registry._readCache(['https://example.com/clear']);
  assert.equal(loaded, null);
});

test('parseMarkdownList extracts skills from bullet list', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const md = `
# Awesome Skills

## Development

- [tdd](https://github.com/example/tdd) - Test-Driven Development workflow
- [debug](https://github.com/example/debug) - Systematic debugging

## Security

- [security-audit](https://github.com/example/sec) - OWASP security scanning
`;
  const entries = registry._parseMarkdownList(md, 'test-source');
  assert.equal(entries.length, 3);
  assert.equal(entries[0].name, 'tdd');
  assert.equal(entries[0].description, 'Test-Driven Development workflow');
  assert.equal(entries[0].url, 'https://github.com/example/tdd');
  assert.equal(entries[0].source, 'test-source');
  assert.equal(entries[1].name, 'debug');
  assert.equal(entries[2].name, 'security-audit');
});

test('parseMarkdownList extracts skills from table', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const md = `
| Name | Description |
|------|-------------|
| [tdd](https://github.com/example/tdd) | Test-Driven Development |
| [debug](https://github.com/example/debug) | Systematic debugging |
`;
  const entries = registry._parseMarkdownList(md, 'test-source');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, 'tdd');
  assert.equal(entries[0].description, 'Test-Driven Development');
});

test('parseMarkdownList handles empty or invalid input', () => {
  const registry = require(path.join(root, 'skill-registry'));
  assert.deepEqual(registry._parseMarkdownList('', 'test'), []);
  assert.deepEqual(registry._parseMarkdownList('# Just a heading\nNo links here', 'test'), []);
});

test('fetchRegistry returns entries from cached data', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const testEntries = [
    { name: 'tdd', url: 'https://github.com/example/tdd', description: 'TDD workflow', source: 'test' },
    { name: 'debug', url: 'https://github.com/example/debug', description: 'Debugging', source: 'test' },
  ];
  registry._writeCache({ entries: testEntries }, registry.REGISTRY_URLS);
  const result = registry.fetchRegistry();
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'tdd');
  assert.equal(result[1].name, 'debug');
});

test('recommend detects gap categories', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = [
    { name: 'tdd', description: 'Test-Driven Development', category: 'testing' },
    { name: 'debug', description: 'Systematic debugging', category: 'development' },
  ];
  const online = [
    { name: 'security-audit', description: 'OWASP scanning', url: 'https://github.com/example/sec', source: 'test' },
    { name: 'vercel-deploy', description: 'Deploy to Vercel', url: 'https://github.com/example/vercel', source: 'test' },
  ];
  const result = registry.recommend(installed, online);
  const gaps = result.filter((r) => r.type === 'gap');
  assert.ok(gaps.length > 0);
  assert.ok(gaps.some((g) => g.category === 'security'));
});

test('recommend detects overlap', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = [
    { name: 'tdd', description: 'TDD workflow', category: 'testing' },
    { name: 'vitest', description: 'Vitest testing', category: 'testing' },
    { name: 'playwright', description: 'E2E testing', category: 'testing' },
    { name: 'jest', description: 'Jest testing', category: 'testing' },
  ];
  const result = registry.recommend(installed, []);
  const overlaps = result.filter((r) => r.type === 'overlap');
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].category, 'testing');
  assert.ok(overlaps[0].count >= 4);
});

test('recommend detects popular skills not installed', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = [
    { name: 'debug', description: 'Debugging', category: 'development' },
  ];
  const online = [
    { name: 'tdd', description: 'TDD workflow', url: 'https://github.com/example/tdd', source: 's1' },
    { name: 'tdd', description: 'TDD workflow', url: 'https://github.com/example/tdd', source: 's2' },
    { name: 'tdd', description: 'TDD workflow', url: 'https://github.com/example/tdd', source: 's3' },
    { name: 'security-audit', description: 'Security', url: 'https://github.com/example/sec', source: 's1' },
  ];
  const result = registry.recommend(installed, online);
  const popular = result.filter((r) => r.type === 'popular');
  assert.ok(popular.length > 0);
  assert.equal(popular[0].name, 'tdd');
});

test('recommend caps overlap skills at 8 with "+ N more" indicator', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = Array.from({ length: 15 }, (_, i) => ({
    name: `skill-${i}`,
    description: `Skill ${i}`,
    category: 'testing',
    source: 'test',
  }));
  const result = registry.recommend(installed, []);
  const overlap = result.find((r) => r.type === 'overlap');
  assert.ok(overlap, 'should have overlap result');
  assert.strictEqual(overlap.skills.length, 8, 'should cap at exactly 8 skills');
  assert.ok(overlap.hasMore === true, 'should indicate more exist');
  assert.strictEqual(overlap.remainingCount, 7, 'should report remaining count');
});

test('overlap with exactly 8 skills has no overflow indicator', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = Array.from({ length: 8 }, (_, i) => ({
    name: `skill-${i}`,
    description: `Skill ${i}`,
    category: 'testing',
    source: 'test',
  }));
  const result = registry.recommend(installed, []);
  const overlap = result.find((r) => r.type === 'overlap');
  assert.ok(overlap, 'should have overlap result');
  assert.strictEqual(overlap.skills.length, 8, 'should have all 8 skills');
  assert.strictEqual(overlap.hasMore, false, 'should not have overflow');
  assert.strictEqual(overlap.remainingCount, 0, 'should have 0 remaining');
});

test('recommend includes action hints for gap categories', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = [];
  const online = [
    { name: 'tdd', url: 'https://github.com/example/tdd', description: 'TDD workflow', source: 'test' },
    { name: 'debug', url: 'https://github.com/example/debug', description: 'Debugging', source: 'test' },
  ];
  const result = registry.recommend(installed, online);
  const gap = result.find((r) => r.type === 'gap');
  assert.ok(gap, 'should have gap result');
  assert.ok(gap.action, 'should include action hint');
  assert.ok(gap.action.length > 0, 'action hint should not be empty');
});

test('popular skills skip entries with example.com URLs', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = [];
  const onlineEntries = [
    { name: 'skill-a', description: 'Skill A', url: 'https://example.com/skill-a', source: 'test' },
    { name: 'skill-b', description: 'Skill B', url: 'https://github.com/real/repo', source: 'test' },
    { name: 'skill-c', description: 'Skill C', url: '', source: 'test' },
  ];

  const results = registry.recommend(installed, onlineEntries);
  const popular = results.filter((r) => r.type === 'popular');

  assert.equal(popular.length, 1);
  assert.equal(popular[0].name, 'skill-b');
});

test('overlap shows top skills sorted by completeness when available', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = [
    { name: 'skill-a', category: 'testing', completeness: 95, sources: ['user'] },
    { name: 'skill-b', category: 'testing', completeness: 60, sources: ['user'] },
    { name: 'skill-c', category: 'testing', completeness: 80, sources: ['user'] },
  ];
  const onlineEntries = [];

  const results = registry.recommend(installed, onlineEntries);
  const overlap = results.find((r) => r.type === 'overlap');

  assert.ok(overlap);
  assert.equal(overlap.skills[0], 'skill-a');
  assert.equal(overlap.skills[1], 'skill-c');
  assert.equal(overlap.skills[2], 'skill-b');
  assert.deepEqual(overlap.completeness, [95, 80, 60]);
});

test('recommend returns empty for perfect stack', () => {
  const registry = require(path.join(root, 'skill-registry'));
  const installed = [
    { name: 'tdd', category: 'testing' },
    { name: 'figma', category: 'design' },
    { name: 'security-audit', category: 'security' },
    { name: 'docs', category: 'documentation' },
    { name: 'cron', category: 'automation' },
    { name: 'vercel', category: 'deployment' },
    { name: 'lint', category: 'code-quality' },
    { name: 'debug', category: 'development' },
  ];
  const result = registry.recommend(installed, []);
  assert.equal(result.length, 0);
});
