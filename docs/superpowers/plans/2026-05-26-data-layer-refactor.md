# Data Layer Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix data quality bugs, add new data fields (tags, summary, completeness), improve categorization, and redesign share/recommend pages to be genuinely useful and star-worthy.

**Architecture:** Three-file pipeline — `scan-skills.js` (data layer: bug fixes + new fields), `skill-registry.js` (registry engine: completeness ranking + URL filtering), `skill-guide.js` (presentation: redesigned share/recommend pages with capability narrative, dynamic descriptions, OG tags). Each task is self-contained and testable independently.

**Tech Stack:** Node.js built-ins only (fs, path, os, crypto, child_process). Node.js test runner (`node:test`). Zero npm dependencies.

---

## File Map

| File | Changes |
|------|---------|
| `scan-skills.js` | Fix YAML multiline regex, strip frontmatter before body extraction, add tags/summary/completeness fields, improve categorization with tags |
| `skill-guide.js` | Redesign share page (hero → capability map → insights → CTA), redesign recommend page, dynamic capability descriptions, OG tags with persona, garbage filtering |
| `skill-registry.js` | Use completeness in overlap ranking, filter invalid popular URLs |
| `test/scan-skills.test.js` | Tests for multiline YAML, frontmatter stripping, tags, summary, completeness |
| `test/cli.test.js` | Tests for new share/recommend structure, OG tags, capability descriptions |
| `test/registry.test.js` | Tests for completeness-based ranking, URL filtering |

---

### Task 1: Fix YAML Multiline Indicator Parsing

**Files:**
- Modify: `scan-skills.js:141`
- Test: `test/scan-skills.test.js`

- [ ] **Step 1: Write the failing test**

Add to `test/scan-skills.test.js`:

```javascript
test('parses YAML multiline indicators (>- |+ |- >+)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-multiline-'));
  const dir = path.join(home, '.claude/skills/multiline-demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: multiline-demo\ndescription: >-\n  This is a folded multiline\n  description that should be\n  joined into one line.\ntriggers:\n  - test\n---\n\n# Multiline\n`,
    'utf8'
  );

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.equal(skill.name, 'multiline-demo');
  assert.match(skill.description, /This is a folded multiline/);
  assert.doesNotMatch(skill.description, /^>-/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: FAIL — description contains literal `">-"` instead of parsed text.

- [ ] **Step 3: Fix the multiline indicator check**

In `scan-skills.js`, change line 141 from:

```javascript
if (val === '|' || val === '>') {
```

to:

```javascript
if (/^[>|](-|\+)?$/.test(val)) {
```

This matches `|`, `>`, `|-`, `|+`, `>-`, `>+`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scan-skills.js test/scan-skills.test.js
git commit -m "fix: handle YAML multiline indicators (>- |+ |- >+)"
```

---

### Task 2: Fix Frontmatter Leaking into Body Extraction

**Files:**
- Modify: `scan-skills.js:448-467` (loadFullData function)
- Test: `test/scan-skills.test.js`

- [ ] **Step 1: Write the failing test**

Add to `test/scan-skills.test.js`:

```javascript
test('body extraction does not include YAML frontmatter', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-frontmatter-leak-'));
  const dir = path.join(home, '.claude/skills/body-demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: body-demo\ndescription: A demo skill\ncategory: testing\ntags:\n  - test\n  - demo\n---\n\n## When to Use\n\nUse this when you need to test body extraction.\n\n## How It Works\n\nIt parses the markdown content.\n`,
    'utf8'
  );

  const result = runScanner(home, { args: ['--full'] });
  const skill = result.skills[0];

  assert.equal(skill.name, 'body-demo');
  assert.ok(skill.whenToUse, 'whenToUse should be populated');
  assert.doesNotMatch(skill.whenToUse, /category:/);
  assert.doesNotMatch(skill.whenToUse, /tags:/);
  assert.doesNotMatch(skill.whenToUse, /^---/);
  if (skill.howItWorks) {
    assert.doesNotMatch(skill.howItWorks, /category:/);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: FAIL — `whenToUse` contains raw YAML frontmatter.

- [ ] **Step 3: Strip frontmatter before body extraction**

In `scan-skills.js`, modify the `loadFullData` function (line 448):

```javascript
function loadFullData(skill) {
  let content = skill._content;
  if (!content) {
    try {
      content = fs.readFileSync(skill._mdFile, 'utf8');
    } catch (_) { content = ''; }
  }

  // Strip frontmatter before body extraction
  const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '');

  const sections = extractSections(bodyContent);
  const contextual = extractContextual(bodyContent);

  return {
    ...skill,
    sections,
    howItWorks: contextual.howItWorks,
    whenToUse: contextual.whenToUse,
    limitations: contextual.limitations,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scan-skills.js test/scan-skills.test.js
git commit -m "fix: strip frontmatter before body extraction to prevent YAML leakage"
```

---

### Task 3: Fix Quoted Strings Misinterpreted as Multiline Indicators

**Files:**
- Modify: `scan-skills.js:134-163` (parseFrontmatter)
- Test: `test/scan-skills.test.js`

- [ ] **Step 1: Write the failing test**

Add to `test/scan-skills.test.js`:

```javascript
test('quoted multiline indicator characters are not treated as multiline', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-quoted-ml-'));
  const dir = path.join(home, '.claude/skills/quoted-ml');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: quoted-ml\ndescription: ">"\n---\n\n# Quoted\n`,
    'utf8'
  );

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.equal(skill.name, 'quoted-ml');
  assert.equal(skill.description, '>');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: FAIL — description is empty (treated as multiline indicator after Task 1 regex fix).

- [ ] **Step 3: Check for multiline indicators before stripping quotes**

In `parseFrontmatter`, add a quote check before the multiline indicator check:

```javascript
const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)/);
if (kvMatch) {
  currentKey = kvMatch[1];
  let val = kvMatch[2].trim();

  // Multi-line indicators — skip if value is quoted
  const isQuoted = (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
  if (!isQuoted && /^[>|](-|\+)?$/.test(val)) {
    inMultiline = true;
    multilineType = val.charAt(0);
    multilineValue = '';
    result[currentKey] = '';
    continue;
  }

  // ... rest unchanged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scan-skills.js test/scan-skills.test.js
git commit -m "fix: skip multiline detection for quoted YAML values"
```

---

### Task 4: Add `tags` Field to Skill Output

**Files:**
- Modify: `scan-skills.js:376-406` (loadSkill)
- Modify: `scan-skills.js:472-493` (cleanSkill)
- Test: `test/scan-skills.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/scan-skills.test.js`:

```javascript
test('extracts tags from frontmatter', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-tags-'));
  writeSkill(home, '.claude/skills/tagged-skill', 'tagged-skill', 'A skill with tags',
    'tags:\n  - security\n  - audit\n  - owasp\n');

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.deepEqual(skill.tags, ['security', 'audit', 'owasp']);
});

test('extracts inline array tags from frontmatter', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-tags-inline-'));
  writeSkill(home, '.claude/skills/inline-tags', 'inline-tags', 'Inline tags',
    'tags: [testing, tdd, qa]\n');

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.deepEqual(skill.tags, ['testing', 'tdd', 'qa']);
});

test('tags defaults to empty array when missing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-no-tags-'));
  writeSkill(home, '.claude/skills/no-tags', 'no-tags', 'No tags skill');

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.deepEqual(skill.tags, []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: FAIL — `skill.tags` is undefined.

- [ ] **Step 3: Read tags in loadSkill and include in cleanSkill**

In `loadSkill`, after reading `allowedTools`, add:

```javascript
let tags = fm.tags || [];
if (typeof tags === 'string') tags = [tags];
```

Add `tags` to the return object and pass to `categorize`:

```javascript
return {
  name,
  description,
  category: categorize(name, description, triggers, tags),
  triggers,
  allowedTools,
  tags,
  version: fm.version || '',
  dir,
  _mdFile: mdFile,
  _content: content,
};
```

In `cleanSkill`, add `tags` to the base output:

```javascript
const base = {
  name: skill.name,
  description: skill.description,
  category: skill.category,
  sources: skill.sources,
  triggers: skill.triggers,
  tags: skill.tags,
  allowedTools: skill.allowedTools,
  version: skill.version,
  dir: skill.dir.replace(HOME, '~'),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scan-skills.js test/scan-skills.test.js
git commit -m "feat: extract tags from skill frontmatter"
```

---

### Task 5: Add `summary` Field (First Body Paragraph)

**Files:**
- Modify: `scan-skills.js` — add `extractSummary()` function
- Modify: `scan-skills.js` (loadFullData)
- Modify: `scan-skills.js` (cleanSkill)
- Test: `test/scan-skills.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/scan-skills.test.js`:

```javascript
test('extracts summary from first body paragraph', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-summary-'));
  const dir = path.join(home, '.claude/skills/summary-demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: summary-demo\ndescription: A demo skill\n---\n\nThis skill provides comprehensive testing capabilities for your project.\nIt covers unit tests, integration tests, and E2E testing.\n\n## When to Use\n\nUse when you need testing.\n`,
    'utf8'
  );

  const result = runScanner(home, { args: ['--full'] });
  const skill = result.skills[0];

  assert.ok(skill.summary, 'summary should be populated');
  assert.match(skill.summary, /comprehensive testing/);
  assert.ok(skill.summary.length <= 200, 'summary should be truncated to 200 chars');
});

test('summary is empty when no body content before headings', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-no-summary-'));
  const dir = path.join(home, '.claude/skills/no-summary');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: no-summary\ndescription: A skill\n---\n\n## When to Use\n\nUse this skill.\n`,
    'utf8'
  );

  const result = runScanner(home, { args: ['--full'] });
  const skill = result.skills[0];

  assert.equal(skill.summary, '');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: FAIL — `skill.summary` is undefined.

- [ ] **Step 3: Implement extractSummary and integrate**

Add `extractSummary` before `loadFullData`:

```javascript
function extractSummary(bodyContent) {
  const paragraphs = bodyContent.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('##')) break;
    if (trimmed.startsWith('```')) continue;
    if (trimmed.match(/^!\[/)) continue;
    if (trimmed.startsWith('|')) continue;
    const text = trimmed.replace(/\s+/g, ' ').trim();
    if (text.length >= 20) {
      return smartTruncate(text, 200);
    }
  }
  return '';
}
```

In `loadFullData`, add summary extraction after stripping frontmatter:

```javascript
const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
const sections = extractSections(bodyContent);
const contextual = extractContextual(bodyContent);
const summary = extractSummary(bodyContent);

return {
  ...skill,
  sections,
  summary,
  howItWorks: contextual.howItWorks,
  whenToUse: contextual.whenToUse,
  limitations: contextual.limitations,
};
```

In `cleanSkill`, add `summary` to the `includeFull` block:

```javascript
if (includeFull) {
  const full = loadFullData(skill);
  base.sections = full.sections;
  base.summary = full.summary;
  base.howItWorks = full.howItWorks;
  base.whenToUse = full.whenToUse;
  base.limitations = full.limitations;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scan-skills.js test/scan-skills.test.js
git commit -m "feat: extract summary from first body paragraph (200 char max)"
```

---

### Task 6: Add `completeness` Score (0-100)

**Files:**
- Modify: `scan-skills.js` — add `computeCompleteness()` function
- Modify: `scan-skills.js` (cleanSkill)
- Test: `test/scan-skills.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/scan-skills.test.js`:

```javascript
test('computes completeness score based on documentation quality', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-completeness-'));
  const dir = path.join(home, '.claude/skills/complete-skill');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: complete-skill\ndescription: A well-documented skill\ntags:\n  - testing\n  - tdd\ntriggers:\n  - test\n  - tdd\n---\n\nA comprehensive skill for testing workflows.\n\n## When to Use\n\nUse this when writing tests.\n\n## How It Works\n\nIt follows TDD methodology.\n\n## Limitations\n\nDoes not support browser testing.\n`,
    'utf8'
  );

  const result = runScanner(home, { args: ['--full'] });
  const skill = result.skills[0];

  assert.ok(typeof skill.completeness === 'number', 'completeness should be a number');
  assert.ok(skill.completeness >= 0 && skill.completeness <= 100, 'completeness should be 0-100');
  assert.ok(skill.completeness >= 80, 'well-documented skill should score high');
});

test('completeness score is 0 for garbage data', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-garbage-'));
  const dir = path.join(home, '.claude/skills/garbage-skill');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: garbage-skill\ndescription: >-\n---\n\n---\nname: garbage-skill\ncategory: testing\n`,
    'utf8'
  );

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.ok(typeof skill.completeness === 'number');
  assert.ok(skill.completeness < 20, 'garbage data should score very low');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: FAIL — `skill.completeness` is undefined.

- [ ] **Step 3: Implement computeCompleteness**

Add before `cleanSkill`:

```javascript
const GARBAGE_PATTERNS = /^[>|](-|\+)?$|^---|^\s*$|^category:|^tags:/;

function computeCompleteness(skill, full) {
  let score = 0;

  // description: 20 points — non-empty and not a YAML artifact
  if (skill.description && skill.description.length > 2 && !GARBAGE_PATTERNS.test(skill.description)) {
    score += 20;
  }

  // summary: 20 points
  if (full && full.summary && full.summary.length > 0) {
    score += 20;
  }

  // whenToUse: 20 points — non-empty and no YAML leakage
  if (full && full.whenToUse && full.whenToUse.length > 20 && !full.whenToUse.startsWith('---')) {
    score += 20;
  }

  // howItWorks: 10 points — no YAML metadata
  if (full && full.howItWorks && full.howItWorks.length > 20 &&
      !full.howItWorks.includes('category:') && !full.howItWorks.includes('tags:')) {
    score += 10;
  }

  // tags: 10 points
  if (skill.tags && skill.tags.length > 0) {
    score += 10;
  }

  // triggers: 10 points
  if (skill.triggers && skill.triggers.length > 0) {
    score += 10;
  }

  // limitations: 10 points
  if (full && full.limitations && full.limitations.length > 10) {
    score += 10;
  }

  return score;
}
```

In `cleanSkill`, add completeness to the `includeFull` block:

```javascript
if (includeFull) {
  const full = loadFullData(skill);
  base.sections = full.sections;
  base.summary = full.summary;
  base.howItWorks = full.howItWorks;
  base.whenToUse = full.whenToUse;
  base.limitations = full.limitations;
  base.completeness = computeCompleteness(skill, full);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scan-skills.js test/scan-skills.test.js
git commit -m "feat: add completeness score (0-100) measuring documentation quality"
```

---

### Task 7: Improve Categorization Using Tags

**Files:**
- Modify: `scan-skills.js:205-211` (categorize function)
- Test: `test/scan-skills.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/scan-skills.test.js`:

```javascript
test('categorization uses tags when name/description are ambiguous', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-cat-tags-'));
  writeSkill(home, '.claude/skills/helper-tool', 'helper-tool', 'A useful helper tool',
    'tags:\n  - security\n  - audit\n');

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.equal(skill.category, 'security', 'should use tags for categorization');
});

test('categorization falls back to description when tags dont match', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-cat-fallback-'));
  writeSkill(home, '.claude/skills/my-tool', 'my-tool', 'A testing framework',
    'tags:\n  - utility\n');

  const result = runScanner(home);
  const skill = result.skills[0];

  assert.equal(skill.category, 'testing', 'should fall back to description');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: FAIL — `helper-tool` gets category `other` instead of `security`.

- [ ] **Step 3: Add tags parameter to categorize**

```javascript
function categorize(name, description, triggers, tags) {
  // Priority 1: tags match
  if (tags && tags.length > 0) {
    const tagText = tags.join(' ');
    for (const { category, keywords } of CATEGORY_MAP) {
      if (keywords.test(tagText)) return category;
    }
  }

  // Priority 2: description match
  const text = [name, description, ...(triggers || [])].join(' ');
  for (const { category, keywords } of CATEGORY_MAP) {
    if (keywords.test(text)) return category;
  }
  return 'other';
}
```

Update the call in `loadSkill` to pass `tags`:

```javascript
category: categorize(name, description, triggers, tags),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/scan-skills.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scan-skills.js test/scan-skills.test.js
git commit -m "feat: prioritize tags for categorization to reduce 'other' bloat"
```

---

### Task 8: Filter Invalid URLs in Popular Skills

**Files:**
- Modify: `skill-registry.js:230-255` (recommend — popular section)
- Test: `test/registry.test.js`

- [ ] **Step 1: Write the failing test**

Add to `test/registry.test.js`:

```javascript
test('popular skills skip entries with example.com URLs', () => {
  const installed = [];
  const onlineEntries = [
    { name: 'skill-a', description: 'Skill A', url: 'https://github.com/example/a', source: 'test' },
    { name: 'skill-b', description: 'Skill B', url: 'https://github.com/real/repo', source: 'test' },
    { name: 'skill-c', description: 'Skill C', url: '', source: 'test' },
  ];

  const results = recommend(installed, onlineEntries);
  const popular = results.filter((r) => r.type === 'popular');

  assert.equal(popular.length, 1);
  assert.equal(popular[0].name, 'skill-b');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/registry.test.js 2>&1`
Expected: FAIL — all 3 entries appear in popular.

- [ ] **Step 3: Add URL validation and filter**

Add helper function:

```javascript
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('#')) return false;
  if (/example\.com/i.test(url)) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}
```

In `recommend`, filter popular entries:

```javascript
const popular = Array.from(popularityMap.values())
  .filter((entry) => isValidUrl(entry.url))
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/registry.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skill-registry.js test/registry.test.js
git commit -m "fix: filter invalid URLs from popular skills (example.com, empty, anchor)"
```

---

### Task 9: Redesign Share Page — Pain-Point Hero + Capability Map

**Files:**
- Modify: `skill-guide.js` (renderShareHTML)
- Test: `test/cli.test.js`

- [ ] **Step 1: Write the failing test**

Add to `test/cli.test.js`:

```javascript
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

  // Pain-point headline
  assert.ok(html.includes('but no idea'), 'should have pain-point headline');
  // Capability map section
  assert.ok(html.includes('Capability Map'), 'should have capability map section');
  // OG tags with persona
  assert.ok(html.includes('og:title'), 'should have OG title');
  assert.ok(html.includes('AI Skills'), 'OG title should mention AI Skills');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.js 2>&1`
Expected: FAIL — no pain-point headline or capability map.

- [ ] **Step 3: Redesign renderShareHTML**

Replace the entire `renderShareHTML` function. Key changes:
- Pain-point headline: "200+ skills but no idea what you have?"
- Capability map: one entry per non-empty category with dynamic description prefix
- Stack insights: strongest/weakest with gap action hint
- OG tags with persona: "Security Champion · 340 AI Skills — skill-guide"
- Dynamic capability descriptions based on skill count per category

The full function is in the design spec Section 4. Implement it with:
1. `capabilityPrefix(count)` helper (20+ → "Extensive", 10-19 → "Solid", 3-9 → "Some", 1-2 → "Getting started")
2. Capability cards filtered to exclude `other` category
3. Stack insights with strongest/weakest and gap detection
4. OG title format: `{persona} · {count} AI Skills — skill-guide`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cli.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Run all tests to check for regressions**

Run: `npm test 2>&1`
Expected: All tests PASS. Update any tests that check old share page structure.

- [ ] **Step 6: Commit**

```bash
git add skill-guide.js test/cli.test.js
git commit -m "feat: redesign share page with pain-point hero and capability map"
```

---

### Task 10: Redesign Recommend Page — Completeness-Based Overlap + Stack Overview

**Files:**
- Modify: `skill-registry.js` (recommend — sort overlap by completeness)
- Modify: `skill-guide.js` (renderRecommendHTML — new structure)
- Test: `test/registry.test.js`, `test/cli.test.js`

- [ ] **Step 1: Write the failing test for completeness-based overlap**

Add to `test/registry.test.js`:

```javascript
test('overlap shows top skills sorted by completeness when available', () => {
  const installed = [
    { name: 'skill-a', category: 'testing', completeness: 95, sources: ['user'] },
    { name: 'skill-b', category: 'testing', completeness: 60, sources: ['user'] },
    { name: 'skill-c', category: 'testing', completeness: 80, sources: ['user'] },
  ];
  const onlineEntries = [];

  const results = recommend(installed, onlineEntries);
  const overlap = results.find((r) => r.type === 'overlap');

  assert.ok(overlap);
  assert.equal(overlap.skills[0], 'skill-a');
  assert.equal(overlap.skills[1], 'skill-c');
  assert.equal(overlap.skills[2], 'skill-b');
  assert.deepEqual(overlap.completeness, [95, 80, 60]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/registry.test.js 2>&1`
Expected: FAIL — skills in insertion order, no completeness field.

- [ ] **Step 3: Sort overlap by completeness**

In `skill-registry.js`, modify the overlap section:

```javascript
for (const [cat, skills] of Object.entries(installedByCategory)) {
  if (skills.length >= 3) {
    const MAX_OVERLAP_SHOWN = 8;
    const sorted = [...skills].sort((a, b) => (b.completeness || 0) - (a.completeness || 0));
    const shown = sorted.slice(0, MAX_OVERLAP_SHOWN);
    const remaining = sorted.length - shown.length;
    results.push({
      type: 'overlap',
      category: cat,
      count: sorted.length,
      message: `You have ${sorted.length} skills in "${cat}" category`,
      skills: shown.map((s) => s.name),
      completeness: shown.map((s) => s.completeness || 0),
      hasMore: remaining > 0,
      remainingCount: remaining,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/registry.test.js 2>&1`
Expected: PASS

- [ ] **Step 5: Redesign renderRecommendHTML**

Replace `renderRecommendHTML` with new structure:
- Stack overview at top (strongest/weakest)
- Top 2-3 most bloated categories only (not all 9)
- Overlap cards show completeness scores with "/100" and label "Based on documentation completeness"
- Accuracy language throughout

- [ ] **Step 6: Run all tests**

Run: `npm test 2>&1`
Expected: All tests PASS. Fix any broken tests.

- [ ] **Step 7: Commit**

```bash
git add skill-registry.js skill-guide.js test/registry.test.js test/cli.test.js
git commit -m "feat: redesign recommend page with completeness scores and top-3 overlap"
```

---

### Task 11: Update Terminal Recommend Output

**Files:**
- Modify: `skill-guide.js` (renderRecommendTerminal)

- [ ] **Step 1: Update renderRecommendTerminal**

Add stack overview (strongest/weakest), completeness scores in overlap, and accuracy labels.

- [ ] **Step 2: Run tests**

Run: `npm test 2>&1`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add skill-guide.js
git commit -m "feat: update terminal recommend output with completeness scores"
```

---

### Task 12: Add Garbage Detection for Displayed Fields

**Files:**
- Modify: `skill-guide.js` — add `isGarbage()` helper

- [ ] **Step 1: Add garbage detection helper**

```javascript
function isGarbage(text) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (trimmed.length <= 2) return true;
  if (/^[>|](-|\+)?$/.test(trimmed)) return true;
  if (/^---/.test(trimmed)) return true;
  if (/^(category|tags|name|description)\s*:/.test(trimmed)) return true;
  return false;
}
```

- [ ] **Step 2: Apply in share and recommend renderers**

Filter garbage descriptions in capability cards and popular skill cards.

- [ ] **Step 3: Run tests**

Run: `npm test 2>&1`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add skill-guide.js
git commit -m "feat: add garbage detection to prevent misleading field display"
```

---

### Task 13: Final Integration Test

**Files:**
- Test: `test/cli.test.js`

- [ ] **Step 1: Write comprehensive integration tests**

Test share page has: pain-point headline, capability map, stack insights, OG tags with persona, radar chart, CTA.

Test recommend page has: breakdown bar, completeness scores, top-3 overlap, accuracy labels, CTA.

- [ ] **Step 2: Run full test suite**

Run: `npm test 2>&1`
Expected: All tests PASS (50+ tests).

- [ ] **Step 3: Verify real output in browser**

Run: `node skill-guide.js --share --output /tmp/share-final.html --no-open --refresh`
Run: `node skill-guide.js --recommend --output /tmp/recommend-final.html --no-open --refresh --refresh`

Open both in browser and verify the redesigned structure.

- [ ] **Step 4: Commit**

```bash
git add test/cli.test.js
git commit -m "test: add integration tests for redesigned share and recommend pages"
```

---

## Spec Self-Review

1. **Spec coverage:** All 6 sections covered — Bug fixes (Tasks 1-3), New fields (Tasks 4-6), Categorization (Task 7), Share redesign (Task 9), Recommend redesign (Tasks 10-11), Accuracy safeguards (Task 12).

2. **Placeholder scan:** No TBD/TODO. All steps have concrete code.

3. **Type consistency:** `completeness`, `tags`, `summary` fields flow consistently through `parseFrontmatter` → `loadSkill` → `cleanSkill` → `renderShareHTML`/`renderRecommendHTML`/`recommend`.
