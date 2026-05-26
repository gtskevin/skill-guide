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
  const result = registry.fetchRegistry({ refresh: true });
  assert.ok(Array.isArray(result));
});
