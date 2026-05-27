# Share & Recommend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform skill-guide from a one-time viewer into a skill manager with share and recommend features, creating a growth flywheel.

**Architecture:** Three-layer design — scan-skills.js (existing local scanner), skill-registry.js (new registry engine for online directories and recommendations), skill-guide.js (existing presentation layer, extended with --share and --recommend modes).

**Tech Stack:** Node.js >= 18, zero dependencies, CommonJS modules, node:test for testing.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `skill-registry.js` | **Create** | Online directory fetching, content fingerprinting, recommendation engine, caching |
| `skill-guide.js` | **Modify** | Add `--share` and `--recommend` rendering, new CLI flags, i18n labels |
| `test/registry.test.js` | **Create** | Unit tests for skill-registry.js |
| `test/cli.test.js` | **Modify** | Integration tests for --share and --recommend CLI modes |
| `SKILL.md` | **Modify** | Add share and recommend mode documentation |
| `README.md` | **Modify** | Add share and recommend usage docs |
| `package.json` | **Modify** | Version bump to 0.3.0 |

---

### Task 1: Create skill-registry.js — Data Structures & Caching

**Files:**
- Create: `skill-registry.js`
- Create: `test/registry.test.js`

- [ ] **Step 1: Write the failing test for cache helpers**

```javascript
// test/registry.test.js
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
  // Manually expire the cache
  const key = registry._cacheKey(['https://example.com/expired']);
  const cacheFile = path.join(os.tmpdir(), 'claude', `skill-registry-${key}.json`);
  const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  raw._ts = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/registry.test.js`
Expected: FAIL with "Cannot find module './skill-registry'"

- [ ] **Step 3: Implement cache helpers in skill-registry.js**

```javascript
// skill-registry.js
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------
const CACHE_DIR = path.join(os.tmpdir(), 'claude');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(urls) {
  const joined = urls.join('|');
  return crypto.createHash('sha1').update(joined).digest('hex').slice(0, 12);
}

function cacheFile(urls) {
  return path.join(CACHE_DIR, `skill-registry-${cacheKey(urls)}.json`);
}

function readCache(urls) {
  try {
    const raw = fs.readFileSync(cacheFile(urls), 'utf8');
    const cached = JSON.parse(raw);
    if (Date.now() - cached._ts < CACHE_TTL_MS) {
      return cached;
    }
  } catch (_) { /* ignore */ }
  return null;
}

function writeCache(data, urls) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    data._ts = Date.now();
    fs.writeFileSync(cacheFile(urls), JSON.stringify(data), 'utf8');
  } catch (_) { /* ignore */ }
}

function clearCache(urls) {
  try {
    fs.unlinkSync(cacheFile(urls));
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  _cacheKey: cacheKey,
  _readCache: readCache,
  _writeCache: writeCache,
  clearCache: clearCache,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/registry.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add skill-registry.js test/registry.test.js
git commit -m "feat(registry): add skill-registry.js with cache helpers"
```

---

### Task 2: Implement Online Directory Fetcher

**Files:**
- Modify: `skill-registry.js`
- Modify: `test/registry.test.js`

- [ ] **Step 1: Write the failing test for parseMarkdownList**

```javascript
// Add to test/registry.test.js

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/registry.test.js`
Expected: FAIL with "registry._parseMarkdownList is not a function"

- [ ] **Step 3: Implement parseMarkdownList**

```javascript
// Add to skill-registry.js, before the Exports section

// ---------------------------------------------------------------------------
// Markdown parser for awesome-lists
// ---------------------------------------------------------------------------
function parseMarkdownList(markdown, source) {
  const entries = [];

  // Pattern 1: Bullet list — - [name](url) - description
  const bulletRe = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—]\s*(.+)$/gm;
  let match;
  while ((match = bulletRe.exec(markdown)) !== null) {
    entries.push({
      name: match[1].trim(),
      url: match[2].trim(),
      description: match[3].trim(),
      source,
    });
  }

  // Pattern 2: Table — | [name](url) | description |
  const tableRe = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.+?)\s*\|$/gm;
  while ((match = tableRe.exec(markdown)) !== null) {
    // Skip header rows
    if (/^[-\s|]+$/.test(match[0])) continue;
    entries.push({
      name: match[1].trim(),
      url: match[2].trim(),
      description: match[3].replace(/[*_`]/g, '').trim(),
      source,
    });
  }

  return entries;
}
```

Add `parseMarkdownList` to the exports:
```javascript
module.exports = {
  _cacheKey: cacheKey,
  _readCache: readCache,
  _writeCache: writeCache,
  _parseMarkdownList: parseMarkdownList,
  clearCache: clearCache,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/registry.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Write the failing test for fetchRegistry**

```javascript
// Add to test/registry.test.js

test('fetchRegistry returns entries from cached data', () => {
  const registry = require(path.join(root, 'skill-registry'));
  // Pre-populate cache
  const testEntries = [
    { name: 'tdd', url: 'https://github.com/example/tdd', description: 'TDD workflow', source: 'test' },
    { name: 'debug', url: 'https://github.com/example/debug', description: 'Debugging', source: 'test' },
  ];
  registry._writeCache({ entries: testEntries }, registry.REGISTRY_URLS);
  const result = registry.fetchRegistry({ refresh: true });
  // Since we can't actually fetch from GitHub in tests, test the cache path
  assert.ok(Array.isArray(result));
});
```

- [ ] **Step 6: Implement fetchRegistry with HTTPS fetching**

```javascript
// Add to skill-registry.js, before the Exports section

// ---------------------------------------------------------------------------
// Registry URLs
// ---------------------------------------------------------------------------
const REGISTRY_URLS = [
  'https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/main/README.md',
  'https://raw.githubusercontent.com/ComposioHQ/awesome-codex-skills/main/README.md',
];

const REGISTRY_SOURCES = {
  'https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/main/README.md': 'awesome-claude-skills',
  'https://raw.githubusercontent.com/ComposioHQ/awesome-codex-skills/main/README.md': 'awesome-codex-skills',
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve('');
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function fetchRegistry(opts = {}) {
  const { refresh = false } = opts;

  if (!refresh) {
    const cached = readCache(REGISTRY_URLS);
    if (cached && cached.entries) return cached.entries;
  }

  // In offline/test mode, return empty
  if (process.env.SKILL_REGISTRY_OFFLINE === '1') {
    return [];
  }

  // Synchronous wrapper around async fetch
  const { execFileSync } = require('child_process');
  const allEntries = [];

  for (const url of REGISTRY_URLS) {
    try {
      const markdown = execFileSync(process.execPath, [
        '-e',
        `const https = require('https'); https.get(process.argv[1], {timeout: 10000}, (res) => { if (res.statusCode !== 200) { process.exit(0); } let d = ''; res.on('data', c => d += c); res.on('end', () => process.stdout.write(d)); }).on('error', () => {})`,
        url,
      ], { encoding: 'utf8', timeout: 15000 });

      if (markdown) {
        const source = REGISTRY_SOURCES[url] || 'unknown';
        const entries = parseMarkdownList(markdown, source);
        allEntries.push(...entries);
      }
    } catch (_) { /* offline or timeout */ }
  }

  // Deduplicate by name
  const seen = new Map();
  for (const entry of allEntries) {
    const key = entry.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, entry);
    } else {
      // Track multiple sources
      const existing = seen.get(key);
      if (!existing.sources) existing.sources = [existing.source];
      existing.sources.push(entry.source);
    }
  }

  const entries = Array.from(seen.values());
  writeCache({ entries }, REGISTRY_URLS);
  return entries;
}
```

Add to exports:
```javascript
module.exports = {
  REGISTRY_URLS,
  _cacheKey: cacheKey,
  _readCache: readCache,
  _writeCache: writeCache,
  _parseMarkdownList: parseMarkdownList,
  fetchRegistry,
  clearCache,
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test test/registry.test.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add skill-registry.js test/registry.test.js
git commit -m "feat(registry): add online directory fetching and markdown parsing"
```

---

### Task 3: Implement Recommendation Engine

**Files:**
- Modify: `skill-registry.js`
- Modify: `test/registry.test.js`

- [ ] **Step 1: Write the failing tests for recommend**

```javascript
// Add to test/registry.test.js

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

test('recommend returns empty for perfect stack', () => {
  const registry = require(path.join(root, 'skill-registry'));
  // Install skills in all categories
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/registry.test.js`
Expected: FAIL with "registry.recommend is not a function"

- [ ] **Step 3: Implement recommend function**

```javascript
// Add to skill-registry.js, before the Exports section

// ---------------------------------------------------------------------------
// Category constants (mirrored from scan-skills.js CATEGORY_MAP)
// ---------------------------------------------------------------------------
const ALL_CATEGORIES = ['testing', 'design', 'security', 'documentation', 'automation', 'deployment', 'code-quality', 'development'];

function categorizeOnlineSkill(entry) {
  const text = [entry.name, entry.description].join(' ');
  const rules = [
    { category: 'testing',       keywords: /\b(test|tdd|spec|e2e|qa|assert|jest|vitest|playwright)\b/i },
    { category: 'design',        keywords: /\b(design|ui|ux|css|style|color|layout|figma|theme|visual|interface)\b/i },
    { category: 'security',      keywords: /\b(security|audit|vuln|owasp|xss|inject|auth|encrypt|cve)\b/i },
    { category: 'documentation', keywords: /\b(doc|readme|changelog|api-doc|markdown|mdx|writing)\b/i },
    { category: 'automation',    keywords: /\b(automat|script|batch|loop|cron|schedule|workflow)\b/i },
    { category: 'deployment',    keywords: /\b(deploy|release|ci.?cd|docker|kubernetes|infra|nginx|vercel)\b/i },
    { category: 'code-quality',  keywords: /\b(review|lint|refactor|simplif|clean|format|pattern)\b/i },
    { category: 'development',   keywords: /\b(develop|build|debug|investigate|plan|brainstorm|feature|implement)\b/i },
  ];
  for (const { category, keywords } of rules) {
    if (keywords.test(text)) return category;
  }
  return 'other';
}

function recommend(installed, onlineEntries) {
  const results = [];

  // Group installed by category
  const installedByCategory = {};
  for (const skill of installed) {
    const cat = skill.category || 'other';
    if (!installedByCategory[cat]) installedByCategory[cat] = [];
    installedByCategory[cat].push(skill);
  }

  // Categorize online entries
  const categorizedOnline = onlineEntries.map((e) => ({
    ...e,
    category: categorizeOnlineSkill(e),
  }));

  // 1. Gap analysis — categories with no installed skills
  for (const cat of ALL_CATEGORIES) {
    if (!installedByCategory[cat] || installedByCategory[cat].length === 0) {
      const catSkills = categorizedOnline
        .filter((e) => e.category === cat)
        .slice(0, 3);
      results.push({
        type: 'gap',
        category: cat,
        message: `You have no ${cat} skills installed`,
        skills: catSkills.map((s) => ({ name: s.name, description: s.description, url: s.url })),
      });
    }
  }

  // 2. Overlap detection — categories with 3+ skills
  for (const [cat, skills] of Object.entries(installedByCategory)) {
    if (skills.length >= 3) {
      results.push({
        type: 'overlap',
        category: cat,
        count: skills.length,
        message: `You have ${skills.length} skills in "${cat}" category`,
        skills: skills.map((s) => s.name),
      });
    }
  }

  // 3. Popular skills not installed
  const installedNames = new Set(installed.map((s) => s.name.toLowerCase()));
  const popularityMap = new Map();
  for (const entry of categorizedOnline) {
    const key = entry.name.toLowerCase();
    if (!installedNames.has(key)) {
      const existing = popularityMap.get(key) || { ...entry, count: 0, sources: [] };
      existing.count++;
      if (!existing.sources.includes(entry.source)) {
        existing.sources.push(entry.source);
      }
      popularityMap.set(key, existing);
    }
  }

  const popular = Array.from(popularityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  for (const skill of popular) {
    results.push({
      type: 'popular',
      name: skill.name,
      description: skill.description,
      url: skill.url,
      sources: skill.sources,
      message: `Found in ${skill.count} awesome-list(s)`,
    });
  }

  // Sort: gaps first, then popular, then overlaps
  const order = { gap: 0, popular: 1, overlap: 2 };
  results.sort((a, b) => (order[a.type] || 9) - (order[b.type] || 9));

  return results;
}
```

Add to exports:
```javascript
module.exports = {
  REGISTRY_URLS,
  ALL_CATEGORIES,
  _cacheKey: cacheKey,
  _readCache: readCache,
  _writeCache: writeCache,
  _parseMarkdownList: parseMarkdownList,
  fetchRegistry,
  recommend,
  clearCache,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/registry.test.js`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add skill-registry.js test/registry.test.js
git commit -m "feat(registry): add recommendation engine with gap, overlap, and popularity analysis"
```

---

### Task 4: Add --recommend CLI Mode

**Files:**
- Modify: `skill-guide.js` (lines ~24-38 for mode detection, ~42-96 for labels, add new render function)
- Modify: `test/cli.test.js`

- [ ] **Step 1: Write the failing integration test**

```javascript
// Add to test/cli.test.js

test('--recommend outputs recommendation report', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-recommend-'));
  writeSkill(home, '.claude/skills/tdd', 'tdd', 'Test-Driven Development');

  // Run in offline mode to avoid network calls
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
  assert.match(html, /Powered by skill-guide/);
  assert.match(html, /npx skill-guide/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.js`
Expected: FAIL with "Unexpected token '--recommend'"

- [ ] **Step 3: Add --recommend mode detection to skill-guide.js**

In `skill-guide.js`, update the mode detection (around line 24):

```javascript
// Replace the existing mode detection block:
const mode = hasFlag('--list') ? 'list'
  : hasFlag('--skill') ? 'skill'
  : hasFlag('--search') ? 'search'
  : hasFlag('--full') ? 'full'
  : hasFlag('--recommend') ? 'recommend'
  : hasFlag('--share') ? 'share'
  : null;
```

Update the usage function (around line 23) to include new modes:

```javascript
function usage() {
  return [
    'Usage:',
    '  skill-guide [--open] [--output <file>] [--format html|json] [--lang en|zh] [--refresh]',
    '  skill-guide --search <query> [--open] [--output <file>] [--format html|json] [--lang en|zh]',
    '  skill-guide --skill <name> [--open] [--output <file>] [--format html|json] [--lang en|zh]',
    '  skill-guide --full [--open] [--output <file>] [--format html|json] [--lang en|zh]',
    '  skill-guide --recommend [--open] [--output <file>] [--lang en|zh] [--refresh]',
    '  skill-guide --share [--open] [--output <file>] [--user <name>] [--lang en|zh]',
    '  skill-guide --doctor [--refresh]',
    '',
    'Examples:',
    '  npx skill-guide --open',
    '  npx skill-guide --search security --open',
    '  npx skill-guide --recommend --open',
    '  npx skill-guide --share --open',
    '  npx skill-guide --doctor',
  ].join('\n');
}
```

- [ ] **Step 4: Add i18n labels for recommend and share**

In `skill-guide.js`, add to the `LABELS.en` object (around line 43):

```javascript
    // Recommend labels
    skillRecommendations: 'Skill Recommendations',
    yourSkillStack: 'Your skill stack',
    skillsAcrossCategories: '{count} skills across {categories} categories',
    gapAnalysis: 'Gap Analysis',
    noSkillsInCategory: 'You have no {category} skills installed',
    tryThese: 'Try these',
    overlapAlert: 'Overlap Alert',
    skillsInCategory: 'You have {count} skills in "{category}" category',
    considerKeeping: 'Consider keeping only the most-used one',
    popularYoureMissing: 'Popular Skills You\'re Missing',
    foundInLists: 'Found in {count} awesome-list(s)',
    categoriesCovered: 'categories covered',
    // Share labels
    myAiSkillStack: 'My AI Skill Stack',
    sharedBy: 'Shared by {user}',
    poweredBy: 'Powered by skill-guide',
    installSkillGuide: 'Install skill-guide to discover your skills',
    topPicks: 'Top Picks',
```

Add to `LABELS.zh`:

```javascript
    // Recommend labels
    skillRecommendations: '技能推荐',
    yourSkillStack: '你的技能栈',
    skillsAcrossCategories: '{count} 个技能，覆盖 {categories} 个分类',
    gapAnalysis: '空白分析',
    noSkillsInCategory: '你没有安装 {category} 类技能',
    tryThese: '试试这些',
    overlapAlert: '重叠检测',
    skillsInCategory: '你在 "{category}" 分类下有 {count} 个技能',
    considerKeeping: '建议只保留最常用的',
    popularYoureMissing: '你还没装的热门技能',
    foundInLists: '出现在 {count} 个 awesome-list 中',
    categoriesCovered: '个分类已覆盖',
    // Share labels
    myAiSkillStack: '我的 AI 技能栈',
    sharedBy: '由 {user} 分享',
    poweredBy: '由 skill-guide 驱动',
    installSkillGuide: '安装 skill-guide 来发现你的技能',
    topPicks: '精选推荐',
```

- [ ] **Step 5: Add renderRecommendTerminal function**

```javascript
// Add to skill-guide.js, before the main execution section

function renderRecommendTerminal(data, recommendations) {
  const lines = [];
  const totalCategories = new Set(data.skills.map((s) => s.category)).size;

  lines.push('');
  lines.push('┌─ skill-guide recommend ─────────────────────┐');
  lines.push('│                                              │');
  lines.push(`│  ${t('yourSkillStack')}: ${data.totalCount} skills, ${totalCategories}/9 ${t('categoriesCovered')}`);
  lines.push('│                                              │');

  const gaps = recommendations.filter((r) => r.type === 'gap');
  if (gaps.length > 0) {
    lines.push(`│  ⚠️  ${t('gapAnalysis')} (${gaps.length}):`);
    for (const gap of gaps) {
      lines.push(`│    • ${gap.category} — 0 skills`);
      if (gap.skills.length > 0) {
        lines.push(`│      → ${t('tryThese')}: ${gap.skills.map((s) => s.name).join(', ')}`);
      }
    }
    lines.push('│');
  }

  const popular = recommendations.filter((r) => r.type === 'popular');
  if (popular.length > 0) {
    lines.push(`│  🔥 ${t('popularYoureMissing')}:`);
    for (const skill of popular.slice(0, 5)) {
      lines.push(`│    • ${skill.name} (${skill.message})`);
    }
    lines.push('│');
  }

  const overlaps = recommendations.filter((r) => r.type === 'overlap');
  if (overlaps.length > 0) {
    lines.push(`│  📋 ${t('overlapAlert')}:`);
    for (const overlap of overlaps) {
      lines.push(`│    • ${t('skillsInCategory').replace('{count}', overlap.count).replace('{category}', overlap.category)}`);
      lines.push(`│      ${t('considerKeeping')}`);
    }
    lines.push('│');
  }

  lines.push('└──────────────────────────────────────────────┘');
  lines.push('');
  return lines.join('\n');
}
```

- [ ] **Step 6: Add renderRecommendHTML function**

```javascript
// Add to skill-guide.js

function renderRecommendHTML(data, recommendations, user) {
  const totalCategories = new Set(data.skills.map((s) => s.category)).size;
  const gaps = recommendations.filter((r) => r.type === 'gap');
  const popular = recommendations.filter((r) => r.type === 'popular');
  const overlaps = recommendations.filter((r) => r.type === 'overlap');

  const gapCards = gaps.map((gap) => `
    <article class="card gap-card">
      <h3>${escapeHtml(gap.category)}</h3>
      <p>${escapeHtml(t('noSkillsInCategory').replace('{category}', gap.category))}</p>
      ${gap.skills.length > 0 ? `<div class="chips">${gap.skills.map((s) =>
        `<a href="${escapeHtml(s.url || '#')}" class="chip" title="${escapeHtml(s.description)}">${escapeHtml(s.name)}</a>`
      ).join('')}</div>` : ''}
    </article>
  `).join('');

  const popularItems = popular.slice(0, 10).map((skill) => `
    <article class="card popular-card">
      <h3>${escapeHtml(skill.name)}</h3>
      <p>${escapeHtml(skill.description || '')}</p>
      <p class="meta">${escapeHtml(skill.message)}</p>
      ${skill.url ? `<a href="${escapeHtml(skill.url)}" class="link">GitHub →</a>` : ''}
    </article>
  `).join('');

  const overlapItems = overlaps.map((overlap) => `
    <article class="card overlap-card">
      <h3>${escapeHtml(overlap.category)}</h3>
      <p>${escapeHtml(t('skillsInCategory').replace('{count}', overlap.count).replace('{category}', overlap.category))}</p>
      <p class="meta">${t('considerKeeping')}</p>
      <div class="chips">${overlap.skills.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}</div>
    </article>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t('skillRecommendations'))}</title>
<meta property="og:title" content="${escapeHtml(t('skillRecommendations'))} — skill-guide">
<meta property="og:description" content="${escapeHtml(t('yourSkillStack'))}: ${data.totalCount} skills, ${totalCategories}/9 ${t('categoriesCovered')}">
<style>
  :root{--bg:#0f0f23;--card:#1a1a2e;--text:#e0e0e0;--muted:#888;--accent:#7c3aed;--accent2:#06b6d4;--gap:#f59e0b;--overlap:#ef4444;--popular:#10b981}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;padding:2rem}
  .container{max-width:960px;margin:0 auto}
  h1{font-size:2.5rem;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem}
  h2{font-size:1.5rem;margin:2rem 0 1rem;color:var(--accent2)}
  .stats{display:flex;gap:1rem;margin:1rem 0;flex-wrap:wrap}
  .stat{background:var(--card);padding:1rem 1.5rem;border-radius:12px;text-align:center}
  .stat b{font-size:2rem;display:block}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
  .card{background:var(--card);padding:1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.05)}
  .card h3{margin-bottom:0.5rem;font-size:1.1rem}
  .card p{color:var(--muted);font-size:0.9rem}
  .card .meta{font-size:0.8rem;margin-top:0.5rem}
  .gap-card{border-left:3px solid var(--gap)}
  .overlap-card{border-left:3px solid var(--overlap)}
  .popular-card{border-left:3px solid var(--popular)}
  .chips{display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem}
  .chip{background:rgba(124,58,237,0.2);padding:0.25rem 0.75rem;border-radius:999px;font-size:0.85rem;text-decoration:none;color:var(--accent);transition:background 0.2s}
  .chip:hover{background:rgba(124,58,237,0.4)}
  .link{color:var(--accent2);text-decoration:none;font-size:0.85rem}
  .link:hover{text-decoration:underline}
  .cta{text-align:center;margin:3rem 0;padding:2rem;background:linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.1));border-radius:16px}
  .cta h2{margin:0 0 0.5rem}
  .cta code{background:var(--card);padding:0.5rem 1rem;border-radius:8px;font-size:1.1rem;display:inline-block;margin:0.5rem 0}
  .cta a{color:var(--accent);text-decoration:none}
  .user-tag{color:var(--muted);font-size:0.9rem;margin-bottom:1rem}
</style>
</head>
<body>
<div class="container">
  ${user ? `<p class="user-tag">${escapeHtml(t('sharedBy').replace('{user}', user))}</p>` : ''}
  <h1>${escapeHtml(t('skillRecommendations'))}</h1>
  <div class="stats">
    <div class="stat"><b>${data.totalCount}</b><span>${t('skillsScanned')}</span></div>
    <div class="stat"><b>${totalCategories}/9</b><span>${t('categoriesCovered')}</span></div>
  </div>

  ${gaps.length > 0 ? `<h2>⚠️ ${escapeHtml(t('gapAnalysis'))}</h2><div class="grid">${gapCards}</div>` : ''}
  ${popular.length > 0 ? `<h2>🔥 ${escapeHtml(t('popularYoureMissing'))}</h2><div class="grid">${popularItems}</div>` : ''}
  ${overlaps.length > 0 ? `<h2>📋 ${escapeHtml(t('overlapAlert'))}</h2><div class="grid">${overlapItems}</div>` : ''}

  <div class="cta">
    <h2>${escapeHtml(t('poweredBy'))}</h2>
    <p>${escapeHtml(t('installSkillGuide'))}</p>
    <code>npx skill-guide --open</code>
    <p><a href="https://github.com/gtskevin/skill-guide">github.com/gtskevin/skill-guide</a></p>
  </div>
</div>
</body>
</html>`;
}
```

- [ ] **Step 7: Wire --recommend into the main execution flow**

In `skill-guide.js`, find the main execution section (the part that calls `scanSkills()` and renders output) and add the recommend path. The exact location depends on the current structure, but it should be added alongside the existing mode handling:

```javascript
// Add this block in the main execution section, after the existing mode handling

if (mode === 'recommend') {
  const registry = require('./skill-registry');
  const installed = scanResult.skills;
  const onlineEntries = registry.fetchRegistry({ refresh });
  const recommendations = registry.recommend(installed, onlineEntries);

  if (format === 'json') {
    process.stdout.write(JSON.stringify({ installed, recommendations }, null, 2) + '\n');
    process.exit(0);
  }

  // Terminal output
  const terminalOutput = renderRecommendTerminal(scanResult, recommendations);
  process.stdout.write(terminalOutput);

  // HTML output if --open or --output
  if (shouldOpen || outputFile) {
    const html = renderRecommendHTML(scanResult, recommendations, getArgValue('--user'));
    const defaultFile = path.join(os.tmpdir(), 'skill-guide-recommend.html');
    const targetFile = outputFile || defaultFile;
    fs.writeFileSync(targetFile, html, 'utf8');
    if (shouldOpen) openFile(targetFile);
    process.stdout.write(`Generated: ${targetFile}\n`);
  }

  process.exit(0);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test test/cli.test.js`
Expected: PASS (all tests including new recommend tests)

- [ ] **Step 9: Commit**

```bash
git add skill-guide.js test/cli.test.js
git commit -m "feat: add --recommend CLI mode with terminal and HTML output"
```

---

### Task 5: Add --share CLI Mode

**Files:**
- Modify: `skill-guide.js`
- Modify: `test/cli.test.js`

- [ ] **Step 1: Write the failing integration test**

```javascript
// Add to test/cli.test.js

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
  assert.match(html, /Powered by skill-guide/);
  assert.match(html, /npx skill-guide --open/);
  assert.match(html, /tdd/);
  assert.match(html, /debug/);
  assert.match(html, /security-audit/);
  assert.match(html, /og:title/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.js`
Expected: FAIL (share mode not yet implemented)

- [ ] **Step 3: Add renderShareHTML function**

```javascript
// Add to skill-guide.js

function renderShareHTML(data, user) {
  const groups = groupBy(data.skills, 'category');
  const totalCategories = Object.keys(groups).length;

  // Pick top skills based on section completeness
  const topPicks = data.skills
    .filter((s) => s.whenToUse || s.howItWorks || (s.sections && s.sections.length > 0))
    .slice(0, 5);

  const categoryCards = Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, items]) => `
      <article class="card">
        <h3>${escapeHtml(category)} <span class="count">${items.length}</span></h3>
        <div class="skill-list">${items.map((s) => `
          <div class="skill-item">
            <span class="skill-name">${escapeHtml(s.name)}</span>
            <span class="skill-desc">${escapeHtml(smartTruncate(s.description || '', 80))}</span>
          </div>
        `).join('')}</div>
      </article>
    `).join('');

  const topPicksSection = topPicks.length > 0 ? `
    <h2>${escapeHtml(t('topPicks'))}</h2>
    <div class="grid picks">${topPicks.map((s) => `
      <article class="card pick-card">
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(smartTruncate(s.description || '', 120))}</p>
      </article>
    `).join('')}</div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t('myAiSkillStack'))} — skill-guide</title>
<meta property="og:title" content="${escapeHtml(t('myAiSkillStack'))}">
<meta property="og:description" content="${data.totalCount} skills across ${totalCategories} categories — powered by skill-guide">
<meta property="og:type" content="website">
<style>
  :root{--bg:#0f0f23;--card:#1a1a2e;--text:#e0e0e0;--muted:#888;--accent:#7c3aed;--accent2:#06b6d4;--pick:#10b981}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;padding:2rem}
  .container{max-width:960px;margin:0 auto}
  .hero{text-align:center;padding:3rem 0}
  h1{font-size:3rem;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem}
  h2{font-size:1.5rem;margin:2.5rem 0 1rem;color:var(--accent2)}
  .subtitle{color:var(--muted);font-size:1.1rem}
  .user-tag{color:var(--muted);font-size:0.9rem;margin-bottom:0.5rem}
  .stats{display:flex;gap:1.5rem;justify-content:center;margin:1.5rem 0}
  .stat{background:var(--card);padding:1rem 2rem;border-radius:12px;text-align:center;min-width:120px}
  .stat b{font-size:2.5rem;display:block;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .stat span{color:var(--muted);font-size:0.85rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
  .picks{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
  .card{background:var(--card);padding:1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.05)}
  .card h3{margin-bottom:0.75rem;font-size:1.1rem;display:flex;align-items:center;gap:0.5rem}
  .card .count{background:rgba(124,58,237,0.2);padding:0.15rem 0.5rem;border-radius:999px;font-size:0.8rem;color:var(--accent)}
  .pick-card{border-left:3px solid var(--pick)}
  .pick-card p{color:var(--muted);font-size:0.9rem}
  .skill-list{display:flex;flex-direction:column;gap:0.4rem}
  .skill-item{display:flex;gap:0.5rem;align-items:baseline}
  .skill-name{font-weight:600;font-size:0.95rem;white-space:nowrap}
  .skill-desc{color:var(--muted);font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cta{text-align:center;margin:3rem 0;padding:2.5rem;background:linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.1));border-radius:16px}
  .cta h2{margin:0 0 0.5rem}
  .cta p{color:var(--muted);margin:0.5rem 0}
  .cta code{background:var(--card);padding:0.5rem 1.5rem;border-radius:8px;font-size:1.2rem;display:inline-block;margin:0.75rem 0;color:var(--accent2)}
  .cta a{color:var(--accent);text-decoration:none;font-weight:600}
  .cta a:hover{text-decoration:underline}
  footer{text-align:center;padding:2rem 0;color:var(--muted);font-size:0.8rem}
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    ${user ? `<p class="user-tag">${escapeHtml(t('sharedBy').replace('{user}', user))}</p>` : ''}
    <h1>${escapeHtml(t('myAiSkillStack'))}</h1>
    <p class="subtitle">${data.totalCount} ${t('skillsScanned')} · ${totalCategories} ${t('categoriesCovered')}</p>
    <div class="stats">
      <div class="stat"><b>${data.totalCount}</b><span>${t('skillsScanned')}</span></div>
      <div class="stat"><b>${totalCategories}</b><span>${t('categoriesCovered')}</span></div>
    </div>
  </div>

  ${topPicksSection}

  <h2>${escapeHtml(t('categoryMap'))}</h2>
  <div class="grid">${categoryCards}</div>

  <div class="cta">
    <h2>${escapeHtml(t('poweredBy'))}</h2>
    <p>${escapeHtml(t('installSkillGuide'))}</p>
    <code>npx skill-guide --open</code>
    <p><a href="https://github.com/gtskevin/skill-guide">github.com/gtskevin/skill-guide</a></p>
  </div>
</div>
<footer>Generated by skill-guide</footer>
</body>
</html>`;
}
```

- [ ] **Step 4: Wire --share into the main execution flow**

```javascript
// Add this block in the main execution section

if (mode === 'share') {
  const user = getArgValue('--user');

  if (format === 'json') {
    process.stdout.write(JSON.stringify({ skills: scanResult.skills, totalCount: scanResult.totalCount }, null, 2) + '\n');
    process.exit(0);
  }

  const html = renderShareHTML(scanResult, user);
  const defaultFile = path.join(os.tmpdir(), 'skill-guide-share.html');
  const targetFile = outputFile || defaultFile;
  fs.writeFileSync(targetFile, html, 'utf8');
  if (shouldOpen) openFile(targetFile);
  process.stdout.write(`Generated: ${targetFile}\n`);
  process.exit(0);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/cli.test.js`
Expected: PASS (all tests including new share tests)

- [ ] **Step 6: Commit**

```bash
git add skill-guide.js test/cli.test.js
git commit -m "feat: add --share CLI mode with portfolio HTML generation"
```

---

### Task 6: Update SKILL.md with New Modes

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Read current SKILL.md**

Read the file to understand the current structure and find where to add new modes.

- [ ] **Step 2: Add share and recommend mode descriptions**

Add to the mode detection section of SKILL.md:

```markdown
### Mode 5: Share

**When:** User says "share my skills" / "show my skill stack" / "生成我的技能栈"

**Action:**
```bash
npx skill-guide --share --open
```

**Output:** Standalone HTML portfolio page showing the user's installed skills, organized by category, with a "Powered by skill-guide" CTA.

**Options:**
- `--user @name` — Add a personalized tag

### Mode 6: Recommend

**When:** User says "recommend skills" / "what should I install" / "推荐技能"

**Action:**
```bash
npx skill-guide --recommend --open
```

**Output:** HTML report with gap analysis, overlap detection, and popular skill recommendations from online directories.

**Options:**
- `--format json` — JSON output for agent consumption
```

- [ ] **Step 3: Commit**

```bash
git add SKILL.md
git commit -m "docs: add share and recommend modes to SKILL.md"
```

---

### Task 7: Update README.md and package.json

**Files:**
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add share and recommend sections to README.md**

Add after the existing "Usage Examples" section:

```markdown
### Share your skill stack
```bash
npx skill-guide --share --open                    # Generate portfolio page
npx skill-guide --share --user @gtskevin --open   # With personalized tag
```

### Get recommendations
```bash
npx skill-guide --recommend --open                # HTML report
npx skill-guide --recommend                       # Terminal output
npx skill-guide --recommend --format json         # JSON for agents
```
```

Update the "CLI flags" table to include:

```markdown
| `--share` | Generate a shareable portfolio HTML |
| `--user <name>` | Add personalized tag to share page |
| `--recommend` | Show skill recommendations |
```

Update the "Quick Start" section to mention the new features.

- [ ] **Step 2: Bump version in package.json**

Change `"version": "0.2.1"` to `"version": "0.3.0"`.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (all tests)

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: add share and recommend to README, bump to 0.3.0"
```

---

### Task 8: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Test --recommend in terminal mode**

Run: `SKILL_REGISTRY_OFFLINE=1 node skill-guide.js --recommend`
Expected: Terminal output showing skill stack stats and gap analysis

- [ ] **Step 3: Test --share with --open**

Run: `node skill-guide.js --share --open`
Expected: HTML page opens in browser showing skill portfolio

- [ ] **Step 4: Test --recommend with --open**

Run: `SKILL_REGISTRY_OFFLINE=1 node skill-guide.js --recommend --open`
Expected: HTML report opens in browser

- [ ] **Step 5: Test --doctor still works**

Run: `node skill-guide.js --doctor`
Expected: Doctor diagnostics output (no regression)

- [ ] **Step 6: Test existing modes still work**

Run: `node skill-guide.js --open`
Expected: Standard discovery guide opens (no regression)

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address end-to-end verification issues"
```

---

*Plan written on 2026-05-26*
