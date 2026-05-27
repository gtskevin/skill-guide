# Output Quality Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the share and recommend HTML outputs from functional-but-bland into viral-worthy pages that create desire and drive adoption.

**Architecture:** Enhance existing `renderShareHTML()` and `renderRecommendHTML()` functions in `skill-guide.js` with better visual design, actionable insights, and social sharing elements. Add helper functions for new components (radar chart, persona tags, smart truncation). All changes stay within the zero-dependency constraint — SVG radar chart is inline, no charting library.

**Tech Stack:** Pure JavaScript, inline SVG, CSS custom properties, Node.js built-ins only.

---

## File Structure

```
skill-guide.js          # Main file — modify renderShareHTML, renderRecommendHTML, add helpers
skill-registry.js       # Modify recommend() to cap overlap chips, add usage hints
test/cli.test.js        # Add tests for new HTML features
test/registry.test.js   # Add tests for improved recommend output
```

No new files created. All changes fit within existing architecture.

---

### Task 1: Fix Recommend Page Data Quality

**Problem:** The recommend page currently shows raw skill lists without curation. Overlap alerts dump 100+ chips. Gap analysis links may point to stale URLs.

**Files:**
- Modify: `skill-registry.js:170-243` (recommend function)
- Modify: `skill-guide.js:839-933` (renderRecommendHTML)
- Modify: `test/registry.test.js`

- [ ] **Step 1: Write the failing test for capped overlap skills**

```javascript
// Add to test/registry.test.js
test('recommend caps overlap skills at 8 with "+ N more" indicator', () => {
  const installed = Array.from({ length: 15 }, (_, i) => ({
    name: `skill-${i}`,
    description: `Skill ${i}`,
    category: 'testing',
    source: 'test',
  }));
  const result = registry.recommend(installed, []);
  const overlap = result.find((r) => r.type === 'overlap');
  assert.ok(overlap, 'should have overlap result');
  assert.ok(overlap.skills.length <= 8, 'should cap at 8 skills');
  assert.ok(overlap.hasMore === true, 'should indicate more exist');
  assert.strictEqual(overlap.remainingCount, 7, 'should report remaining count');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/registry.test.js`
Expected: FAIL — `overlap.hasMore` is undefined, `overlap.skills` has 15 items

- [ ] **Step 3: Implement capped overlap in recommend()**

In `skill-registry.js`, modify the overlap detection block (around line 200):

```javascript
// 2. Overlap detection — categories with 3+ skills
for (const [cat, skills] of Object.entries(installedByCategory)) {
  if (skills.length >= 3) {
    const MAX_OVERLAP_SHOWN = 8;
    const shown = skills.slice(0, MAX_OVERLAP_SHOWN);
    const remaining = skills.length - shown.length;
    results.push({
      type: 'overlap',
      category: cat,
      count: skills.length,
      message: `You have ${skills.length} skills in "${cat}" category`,
      skills: shown.map((s) => s.name),
      hasMore: remaining > 0,
      remainingCount: remaining,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/registry.test.js`
Expected: PASS

- [ ] **Step 5: Update renderRecommendHTML to show "+ N more" for overlap**

In `skill-guide.js`, modify the overlap card template (around line 864):

```javascript
const overlapItems = overlaps.map((overlap) => `
  <article class="card overlap-card">
    <h3>${escapeHtml(overlap.category)}</h3>
    <p>${escapeHtml(t('skillsInCategory').replace('{count}', overlap.count).replace('{category}', overlap.category))}</p>
    <p class="meta">${t('considerKeeping')}</p>
    <div class="chips">${overlap.skills.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}${
      overlap.hasMore ? `<span class="chip-more">+ ${overlap.remainingCount} more</span>` : ''
    }</div>
  </article>
`).join('');
```

Add CSS for `.chip-more`:

```css
.chip-more{background:rgba(255,255,255,0.05);padding:0.25rem 0.75rem;border-radius:999px;font-size:0.85rem;color:var(--muted)}
```

- [ ] **Step 6: Write test for action hints in gap recommendations**

```javascript
// Add to test/registry.test.js
test('recommend includes action hints for gap categories', () => {
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
```

- [ ] **Step 7: Run test to verify it fails**

Run: `node --test test/registry.test.js`
Expected: FAIL — `gap.action` is undefined

- [ ] **Step 8: Add action hints to gap results**

In `skill-registry.js`, add action hints after the gap detection loop:

```javascript
const GAP_ACTIONS = {
  testing: 'Add a TDD skill to catch bugs before they ship',
  design: 'Add a UI/UX skill to improve your frontend output',
  security: 'Add a security audit skill to catch vulnerabilities',
  documentation: 'Add a docs skill to keep your project well-documented',
  automation: 'Add an automation skill to eliminate repetitive tasks',
  deployment: 'Add a deploy skill to streamline your CI/CD pipeline',
  'code-quality': 'Add a code review skill to maintain standards',
  development: 'Add a dev workflow skill to boost productivity',
};
```

In the gap detection block, add `action` field:

```javascript
results.push({
  type: 'gap',
  category: cat,
  message: `You have no ${cat} skills installed`,
  action: GAP_ACTIONS[cat] || `Explore ${cat} skills to fill this gap`,
  skills: catSkills.map((s) => ({ name: s.name, description: s.description, url: s.url })),
});
```

- [ ] **Step 9: Run all tests**

Run: `node --test test/*.test.js`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add skill-registry.js skill-guide.js test/registry.test.js
git commit -m "fix: improve recommend page quality — cap overlap chips, add action hints"
```

---

### Task 2: Add Developer Persona Tags to Share Page

**Problem:** The share page shows a flat list of skills without telling the viewer "what kind of developer" this person is. Persona tags create identity and social currency.

**Files:**
- Modify: `skill-guide.js:935-1037` (renderShareHTML — add persona generation)
- Modify: `skill-guide.js:46-129` (LABELS — add persona label keys)
- Modify: `test/cli.test.js`

- [ ] **Step 1: Write the failing test for persona tags**

```javascript
// Add to test/cli.test.js
test('share HTML output contains persona section', () => {
  const tmpFile = path.join(os.tmpdir(), 'test-share-persona.html');
  execFileSync('node', ['skill-guide.js', '--share', '--output', tmpFile], {
    encoding: 'utf8',
    env: { ...process.env, HOME: fakeHome },
    timeout: 15000,
  });
  const html = fs.readFileSync(tmpFile, 'utf8');
  assert.ok(html.includes('persona'), 'should contain persona section');
  assert.ok(html.includes('Developer') || html.includes('Engineer') || html.includes('Builder') || html.includes('Explorer') || html.includes('Collector'), 'should contain a persona label');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.js`
Expected: FAIL — persona section not found in HTML

- [ ] **Step 3: Implement persona generation helper**

Add before `renderShareHTML` in `skill-guide.js`:

```javascript
function generatePersona(skills) {
  const categories = {};
  for (const s of skills) {
    const cat = s.category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  }

  const total = skills.length;
  const personas = [];

  if ((categories.security || 0) / total > 0.15) personas.push('Security Champion');
  if ((categories.testing || 0) / total > 0.15) personas.push('Quality Engineer');
  if ((categories.deployment || 0) / total > 0.15) personas.push('DevOps Builder');
  if ((categories.automation || 0) / total > 0.15) personas.push('Automation Architect');
  if ((categories.design || 0) / total > 0.15) personas.push('Design System Crafter');
  if ((categories.documentation || 0) / total > 0.1) personas.push('Documentation Advocate');
  if ((categories['code-quality'] || 0) / total > 0.1) personas.push('Code Quality Guardian');

  if (personas.length === 0) {
    if (total > 50) personas.push('Skill Collector');
    else if (total > 20) personas.push('Full-Stack Explorer');
    else personas.push('Focused Builder');
  }

  return personas.slice(0, 2).join(' · ');
}
```

- [ ] **Step 4: Add persona section to renderShareHTML**

In `renderShareHTML`, compute persona:

```javascript
const persona = generatePersona(data.skills);
```

In the HTML template, after the subtitle:

```html
<p class="persona">${escapeHtml(persona)}</p>
```

Add CSS:

```css
.persona{font-size:1.3rem;color:var(--accent);font-weight:600;margin:0.5rem 0;letter-spacing:0.05em}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/cli.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add skill-guide.js test/cli.test.js
git commit -m "feat(share): add developer persona tags based on skill composition"
```

---

### Task 3: Add SVG Radar Chart to Share Page

**Problem:** Numbers and lists don't give an instant visual sense of skill distribution. A radar chart makes the share page dramatically more visual and shareable.

**Files:**
- Modify: `skill-guide.js:935-1037` (renderShareHTML — add radar chart)
- Modify: `test/cli.test.js`

- [ ] **Step 1: Write the failing test for radar chart**

```javascript
// Add to test/cli.test.js
test('share HTML contains SVG radar chart', () => {
  const tmpFile = path.join(os.tmpdir(), 'test-share-radar.html');
  execFileSync('node', ['skill-guide.js', '--share', '--output', tmpFile], {
    encoding: 'utf8',
    env: { ...process.env, HOME: fakeHome },
    timeout: 15000,
  });
  const html = fs.readFileSync(tmpFile, 'utf8');
  assert.ok(html.includes('<svg'), 'should contain SVG element');
  assert.ok(html.includes('radar') || html.includes('polygon'), 'should contain radar chart elements');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.js`
Expected: FAIL — no SVG in share HTML

- [ ] **Step 3: Implement radar chart helper**

Add before `renderShareHTML` in `skill-guide.js`:

```javascript
function renderRadarChart(skills) {
  const CATEGORIES = ['testing', 'design', 'security', 'documentation', 'automation', 'deployment', 'code-quality', 'development'];
  const LABELS_SHORT = ['Test', 'Design', 'Security', 'Docs', 'Auto', 'Deploy', 'Quality', 'Dev'];

  const counts = {};
  for (const cat of CATEGORIES) counts[cat] = 0;
  for (const s of skills) {
    const cat = s.category || 'other';
    if (counts[cat] !== undefined) counts[cat]++;
  }

  const maxCount = Math.max(...Object.values(counts), 1);
  const cx = 150, cy = 150, r = 120;
  const angleStep = (2 * Math.PI) / CATEGORIES.length;

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0].map((scale) => {
    const points = CATEGORIES.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + r * scale * Math.cos(angle);
      const y = cy + r * scale * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
    return `<polygon points="${points}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  }).join('\n    ');

  // Data polygon
  const dataPoints = CATEGORIES.map((cat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const value = counts[cat] / maxCount;
    const x = cx + r * value * Math.cos(angle);
    const y = cy + r * value * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  // Labels
  const labels = CATEGORIES.map((cat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const lx = cx + (r + 25) * Math.cos(angle);
    const ly = cy + (r + 25) * Math.sin(angle);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#888" font-size="11">${LABELS_SHORT[i]}</text>`;
  }).join('\n    ');

  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" class="radar-chart">
    ${rings}
    <polygon points="${dataPoints}" fill="rgba(124,58,237,0.2)" stroke="#7c3aed" stroke-width="2"/>
    ${labels}
  </svg>`;
}
```

- [ ] **Step 4: Add radar chart to renderShareHTML**

In `renderShareHTML`, after the stats section and before top picks:

```javascript
const radarChart = renderRadarChart(data.skills);
```

In the HTML template:

```html
<div class="radar-container">${radarChart}</div>
```

Add CSS:

```css
.radar-container{display:flex;justify-content:center;margin:2rem 0}
.radar-chart{width:300px;height:300px}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/cli.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add skill-guide.js test/cli.test.js
git commit -m "feat(share): add SVG radar chart for skill distribution visualization"
```

---

### Task 4: Enhance CTA with Social Proof and Urgency

**Problem:** The current CTA is passive — "Install skill-guide to discover your skills." No urgency, no social proof, no reason to act now.

**Files:**
- Modify: `skill-guide.js:1027-1032` (CTA section in renderShareHTML)
- Modify: `skill-guide.js:924-929` (CTA section in renderRecommendHTML)
- Modify: `skill-guide.js:46-129` (LABELS)

- [ ] **Step 1: Add new i18n labels**

In `LABELS.en`, add:

```javascript
ctaHeadline: 'Stop guessing. Start using.',
ctaSubtext: 'Join developers who discovered skills they never knew they had',
ctaAction: 'Discover Your Skills',
ctaGithub: 'Star on GitHub',
```

In `LABELS.zh`, add:

```javascript
ctaHeadline: '别再猜了，开始用吧',
ctaSubtext: '加入已发现隐藏技能的开发者行列',
ctaAction: '发现你的技能',
ctaGithub: '在 GitHub 上 Star',
```

- [ ] **Step 2: Update share page CTA**

Replace the CTA section in `renderShareHTML`:

```html
<div class="cta">
  <h2>${escapeHtml(t('ctaHeadline'))}</h2>
  <p class="cta-sub">${escapeHtml(t('ctaSubtext'))}</p>
  <code>npx skill-guide --open</code>
  <div class="cta-actions">
    <a href="https://github.com/gtskevin/skill-guide" class="cta-btn primary">${escapeHtml(t('ctaGithub'))}</a>
  </div>
</div>
```

Add CSS:

```css
.cta-sub{color:var(--muted);margin:0.5rem 0 1.5rem;font-size:1rem}
.cta-actions{display:flex;gap:1rem;justify-content:center;margin-top:1.5rem}
.cta-btn{display:inline-block;padding:0.75rem 2rem;border-radius:8px;font-weight:600;text-decoration:none;font-size:1rem;transition:transform 0.2s,box-shadow 0.2s}
.cta-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(124,58,237,0.3)}
.cta-btn.primary{background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff}
```

- [ ] **Step 3: Update recommend page CTA**

Apply the same CTA pattern to `renderRecommendHTML`.

- [ ] **Step 4: Run all tests**

Run: `node --test test/*.test.js`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add skill-guide.js
git commit -m "feat: enhance CTA with social proof, urgency, and gradient button"
```

---

### Task 5: Improve Share Page Top Picks with Usage Context

**Problem:** Top picks show skill name + truncated description but no context about WHY this skill is a top pick or WHEN to use it.

**Files:**
- Modify: `skill-guide.js:957-965` (topPicksSection in renderShareHTML)

- [ ] **Step 1: Enhance top pick cards with trigger/whenToUse info**

Replace the top picks card template:

```javascript
const topPicksSection = topPicks.length > 0 ? `
  <h2>${escapeHtml(t('topPicks'))}</h2>
  <div class="grid picks">${topPicks.map((s) => {
    const trigger = s.triggers ? s.triggers.slice(0, 3).join(', ') : '';
    const whenToUse = s.whenToUse ? truncate(s.whenToUse, 100) : '';
    return `
      <article class="card pick-card">
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(truncate(s.description || '', 120))}</p>
        ${trigger ? `<p class="pick-trigger">Triggers: ${escapeHtml(trigger)}</p>` : ''}
        ${whenToUse ? `<p class="pick-when">${escapeHtml(whenToUse)}</p>` : ''}
      </article>
    `;
  }).join('')}</div>
` : '';
```

Add CSS:

```css
.pick-trigger{color:var(--accent);font-size:0.8rem;margin-top:0.5rem;font-style:italic}
.pick-when{color:var(--muted);font-size:0.8rem;margin-top:0.25rem}
```

- [ ] **Step 2: Run all tests**

Run: `node --test test/*.test.js`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add skill-guide.js
git commit -m "feat(share): enrich top picks with triggers and usage context"
```

---

### Task 6: Add Skill Count Breakdown to Recommend Page Stats

**Problem:** The recommend page shows total count and category coverage but doesn't break down the distribution. Users can't quickly see which categories dominate.

**Files:**
- Modify: `skill-guide.js:839-933` (renderRecommendHTML — enhance stats section)

- [ ] **Step 1: Add category breakdown bar**

After the stats div in `renderRecommendHTML`, add a visual breakdown:

```javascript
const categoryBreakdown = Object.entries(
  data.skills.reduce((acc, s) => { const c = s.category || 'other'; acc[c] = (acc[c] || 0) + 1; return acc; }, {})
).sort((a, b) => b[1] - a[1]);

const colors = {
  testing: '#10b981', design: '#f59e0b', security: '#ef4444', documentation: '#8b5cf6',
  automation: '#06b6d4', deployment: '#ec4899', 'code-quality': '#14b8a6', development: '#f97316', other: '#6b7280',
};

const breakdownBar = categoryBreakdown.map(([cat, count]) => {
  const pct = Math.round((count / data.totalCount) * 100);
  const color = colors[cat] || '#6b7280';
  return `<div class="breakdown-segment" style="width:${pct}%;background:${color}" title="${cat}: ${count} (${pct}%)"></div>`;
}).join('');
```

In the HTML template:

```html
<div class="breakdown-bar">${breakdownBar}</div>
<div class="breakdown-legend">${categoryBreakdown.map(([cat, count]) =>
  `<span class="legend-item"><span class="legend-dot" style="background:${colors[cat] || '#6b7280'}"></span>${cat} (${count})</span>`
).join('')}</div>
```

Add CSS:

```css
.breakdown-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:1rem 0 0.5rem}
.breakdown-segment{min-width:2px;transition:width 0.3s}
.breakdown-legend{display:flex;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.5rem}
.legend-item{display:flex;align-items:center;gap:0.35rem;font-size:0.8rem;color:var(--muted)}
.legend-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
```

- [ ] **Step 2: Run all tests**

Run: `node --test test/*.test.js`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add skill-guide.js
git commit -m "feat(recommend): add category breakdown bar to stats section"
```

---

### Task 7: Final Integration Test and Manual Verification

**Files:**
- Modify: `test/cli.test.js` (add end-to-end smoke tests)

- [ ] **Step 1: Write integration tests for both modes**

```javascript
test('share HTML is valid and contains all enhanced sections', () => {
  const tmpFile = path.join(os.tmpdir(), 'test-share-final.html');
  execFileSync('node', ['skill-guide.js', '--share', '--output', tmpFile], {
    encoding: 'utf8',
    env: { ...process.env, HOME: fakeHome },
    timeout: 15000,
  });
  const html = fs.readFileSync(tmpFile, 'utf8');
  assert.ok(html.includes('<!DOCTYPE html>'), 'valid HTML');
  assert.ok(html.includes('og:title'), 'has OG tags');
  assert.ok(html.includes('persona'), 'has persona section');
  assert.ok(html.includes('<svg'), 'has radar chart');
});

test('recommend HTML is valid and contains enhanced sections', () => {
  const tmpFile = path.join(os.tmpdir(), 'test-recommend-final.html');
  execFileSync('node', ['skill-guide.js', '--recommend', '--output', tmpFile], {
    encoding: 'utf8',
    env: { ...process.env, HOME: fakeHome, SKILL_REGISTRY_OFFLINE: '1' },
    timeout: 15000,
  });
  const html = fs.readFileSync(tmpFile, 'utf8');
  assert.ok(html.includes('<!DOCTYPE html>'), 'valid HTML');
  assert.ok(html.includes('og:title'), 'has OG tags');
  assert.ok(html.includes('breakdown'), 'has category breakdown');
});
```

- [ ] **Step 2: Run all tests**

Run: `node --test test/*.test.js`
Expected: ALL PASS

- [ ] **Step 3: Manual verification — generate and open both pages**

```bash
node skill-guide.js --share --open
node skill-guide.js --recommend --open
```

Verify in browser:
- Share page shows persona tag, radar chart, enriched top picks, enhanced CTA
- Recommend page shows capped overlap chips, action hints, category breakdown bar
- Both pages look good on mobile viewport

- [ ] **Step 4: Commit**

```bash
git add test/cli.test.js
git commit -m "test: add integration tests for enhanced share and recommend outputs"
```

---

## Self-Review Checklist

1. **Spec coverage:** All 6 improvements from the evaluation are covered:
   - ✅ Fix recommend data quality (capped overlaps, action hints)
   - ✅ Developer persona tags
   - ✅ SVG radar chart
   - ✅ Enhanced CTA with social proof
   - ✅ Enriched top picks with usage context
   - ✅ Category breakdown visualization

2. **Placeholder scan:** No TBD/TODO/incomplete steps. All code blocks are complete.

3. **Type consistency:** `overlap.hasMore`, `overlap.remainingCount`, `gap.action` fields are defined in Task 1 and consumed in the same task. `generatePersona` and `renderRadarChart` are new functions with consistent signatures.

4. **Zero-dependency constraint:** All enhancements use inline SVG, CSS, and pure JS. No new npm packages.

5. **i18n:** New labels added to both `en` and `zh` in LABELS object.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-output-quality-improvements.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
