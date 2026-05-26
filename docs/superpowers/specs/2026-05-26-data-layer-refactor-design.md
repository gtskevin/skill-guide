# Data Layer Refactor Design

> **状态：** 待评审
> **日期：** 2026-05-26

## Goal

Refactor the skill data layer to fix parsing bugs, improve data quality, and redesign share/recommend output so that:
1. Share page makes anyone seeing it want to run `npx skill-guide --open`
2. Recommend page gives genuinely useful, personalized insights
3. No output is misleading or inaccurate

## Constraints

- Zero npm dependencies (regex-based parsing only)
- `scan-skills.js` stays one file
- Backward compatible — existing `--list`, `--skill`, `--search`, `--full` output format must not break

---

## Section 1: Bug Fixes

### 1.1 YAML multiline indicators

**Bug:** `parseFrontmatter()` line 141 only checks `val === '|' || val === '>'`. YAML `>-`, `|-`, `>+`, `|+` are not recognized, causing 6 skills to get literal `">-"` as description.

**Fix:** Change the check to `/^[>|](-|\+)?$/` regex.

### 1.2 Frontmatter leaking into body extraction

**Bug:** `extractSections()` and `extractContextual()` receive raw file content including the `---` delimited YAML block. This causes:
- 12 skills have `whenToUse` containing raw YAML
- 61 skills have `howItWorks` containing YAML metadata

**Fix:** In `loadFullData()`, strip frontmatter before passing content to body extraction functions:
```javascript
const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
```

### 1.3 Quoted strings misinterpreted as multiline indicators

**Bug:** `description: ">"` — the quotes are stripped first, then `>` is checked against multiline indicator.

**Fix:** Check for multiline indicators BEFORE stripping quotes. Or: if the original value was quoted, skip multiline detection.

---

## Section 2: New Data Fields

### 2.1 `tags` — keyword array

**Source:** `fm.tags` from frontmatter (many skills already define this).
**Format:** Array of strings. Support both YAML array `[a, b, c]` and comma-separated `a, b, c`.
**Fallback:** Empty array `[]`.

### 2.2 `summary` — body paragraph

**Source:** First non-empty paragraph in SKILL.md body, before any `##` heading.
**Extraction:** New `extractSummary(bodyContent)` function.
**Truncation:** 200 characters max.
**Fallback:** Empty string `""`.

### 2.3 `completeness` — quality score (0-100)

**Purpose:** Measures documentation quality (NOT skill quality). Used for:
- Selecting which skills to showcase as examples
- Ranking skills within overlap alerts
- Accuracy safeguard: always label as "documentation completeness"

**Scoring rules:**

| Field | Points | Condition |
|-------|--------|-----------|
| description | 20 | Non-empty AND not a YAML artifact |
| summary | 20 | Non-empty |
| whenToUse | 20 | Non-empty AND does not start with `---` |
| howItWorks | 10 | Non-empty AND does not contain `category:` or `tags:` |
| tags | 10 | Array with length > 0 |
| triggers | 10 | Array with length > 0 |
| limitations | 10 | Non-empty |

Each field check includes garbage detection — YAML metadata patterns get 0 points.

---

## Section 3: Improved Categorization

### 3.1 Use tags for better category assignment

**Priority order:**
1. `tags` array matches a category's keywords
2. `description` text matches category keywords
3. `name` text matches category keywords
4. Default to `other`

### 3.2 Reduce "other" bloat

**Current:** 123/340 skills (36%) in "other".
**Target:** <20% after using tags.

---

## Section 4: Share Page Redesign

### Design principles (from research)

1. **7-second rule** — first screen must sell the tool AND the user's stack
2. **Pain-first** — lead with what the visitor doesn't know, not what the tool does
3. **"Your turn" hook** — every section should make the visitor want to run the command
4. **Page = demo** — the share page itself demonstrates the tool's capabilities

### 4.1 Page structure

```
┌─────────────────────────────────────────┐
│ HERO (7-second sell)                     │
│                                          │
│ "200+ skills but no idea what you have?"│  ← pain point (universal)
│                                          │
│ skill-guide scans everything and shows   │  ← context for new visitors
│ you.                                     │
│                                          │
│ @gtskevin's stack:                       │  ← personalization
│ Security Champion · 340 skills           │  ← persona
│ [雷达图]                                  │  ← visual proof
├─────────────────────────────────────────┤
│ CAPABILITY MAP (what can this agent do?) │
│                                          │
│ 🛡️ Security (33) — Deep coverage.       │
│    Audit code, check OWASP, scan CVEs    │
│    e.g. security-audit                   │
│                                          │
│ 🎨 Design (53) — Extensive coverage.     │
│    Critique UI, generate themes, slides   │
│    e.g. design-critique                  │
│                                          │
│ 🧪 Testing (28) — Solid coverage.        │
│    Write TDD, run E2E, debug systems      │
│    e.g. playwright                       │
│                                          │
│ ... (one entry per non-empty category)   │
├─────────────────────────────────────────┤
│ STACK INSIGHTS (personalized analysis)   │
│                                          │
│ 💪 Strongest: Security (33 skills)       │
│ ⚠️ Gap: Documentation (0 skills)         │
│    Add a docs skill to keep your project │
│    well-documented.                      │
│                                          │
│ Run --recommend for full analysis        │
├─────────────────────────────────────────┤
│ CTA ("your turn" hook)                   │
│                                          │
│ What's YOUR stack?                       │  ← challenge
│ npx skill-guide --open                   │
│ [Star on GitHub]                         │
└─────────────────────────────────────────┘
```

### 4.2 Dynamic capability descriptions

Capability descriptions change based on skill count in that category:

| Count | Description prefix | Example |
|-------|-------------------|---------|
| 20+ | "Extensive coverage." | "Extensive coverage. Audit code, check OWASP, scan CVEs" |
| 10-19 | "Solid coverage." | "Solid coverage. Write TDD, run E2E, debug systems" |
| 3-9 | "Some coverage." | "Some coverage. Critique UI, generate themes" |
| 1-2 | "Getting started." | "Getting started. Basic code review" |

**Why dynamic:** A user with 33 security skills should see different text than one with 3. This makes the capability narrative feel personalized, not templated.

### 4.3 OG tags

```html
<meta property="og:title" content="{persona} · {count} AI Skills — skill-guide">
<meta property="og:description" content="I can {top 3 capabilities}. Here's my full AI skill stack.">
```

**Example:**
```
og:title = "Security Champion · 340 AI Skills — skill-guide"
og:description = "I can audit code, design UI, write tests. Here's my full AI skill stack."
```

### 4.4 "Improve your stack" section

Below the capability map, show the weakest 1-2 categories with actionable suggestions:

```
⚠️ Your weakest area: Documentation (0 skills)
   Try: doc-coauthoring — writes docs alongside your code
```

This serves two purposes:
1. Gives the user actionable value (not just a pretty page)
2. Shows visitors that skill-guide provides real analysis (demo effect)

### 4.5 Representative skill selection

For each category in the capability map, select one example skill:
- Primary: highest `completeness` in that category
- Fallback: first skill with non-empty description
- Label as "e.g." not "recommended" (accuracy safeguard)

---

## Section 5: Recommend Page Redesign

### 5.1 Page structure

```
┌─────────────────────────────────────────┐
│ STACK OVERVIEW                           │
│ [分类分布条]                              │
│                                          │
│ 💪 Strongest: Security (33)              │
│ ⚠️ Gap: Documentation (0)                │
├─────────────────────────────────────────┤
│ CLEANUP OPPORTUNITIES (top 2-3 only)     │
│                                          │
│ design (53 skills) — significant overlap │
│ Most documented:                         │
│  1. design-critique (95/100)             │
│  2. ui-ux-pro-max (88/100)              │
│  3. liquid-glass-design (82/100)         │
│ Based on documentation completeness.     │
├─────────────────────────────────────────┤
│ YOU MIGHT NOT KNOW (personalized)        │
│                                          │
│ Based on your security + testing skills: │
│ • systematic-debugging                   │
│   Structured root cause analysis         │
│ • e2e-testing                            │
│   Browser-based end-to-end testing       │
├─────────────────────────────────────────┤
│ GAP ANALYSIS                             │
│                                          │
│ ⚠️ Documentation (0 skills)              │
│ Add a docs skill to keep your project    │
│ well-documented.                         │
│ Try: doc-coauthoring                     │
├─────────────────────────────────────────┤
│ CTA                                      │
│ What's YOUR stack?                       │
│ npx skill-guide --open                   │
│ [Star on GitHub]                         │
└─────────────────────────────────────────┘
```

### 5.2 Overlap alert — "top N by documentation completeness"

Show only the top 2-3 most bloated categories (not all 9). For each:
- List the 3 most documented skills with completeness scores
- Label clearly: "Based on documentation completeness"
- Never say "best skills" or "top skills"

### 5.3 "You might not know" — personalized recommendations

Based on the user's category combination, suggest skills from categories they already have but might not know about:

```javascript
const COMBO_RECOMMENDATIONS = {
  'security+testing': ['systematic-debugging', 'e2e-testing', 'security-bounty-hunter'],
  'automation+deployment': ['github-ops', 'vercel-deploy', 'ci-cd-optimizer'],
  'design+development': ['frontend-patterns', 'component-library', 'design-system'],
  'testing+code-quality': ['tdd-workflow', 'code-review', 'refactoring-patterns'],
};
```

Only show if the recommended skill is NOT already installed.

### 5.4 Popular skills — real URLs only

Use actual URLs from the awesome-list data. If URL is missing, invalid, or `example.com`, don't show a link. Show description from the online entry if available.

---

## Section 6: Accuracy Safeguards

### 6.1 Language rules

| ✅ Say | ❌ Don't say |
|--------|-------------|
| "based on documentation completeness" | "best skills" |
| "most documented" | "top skills" |
| "e.g. security-audit" | "recommended: security-audit" |
| "Extensive coverage" | "Expert level" |
| "Your weakest area" | "You're bad at" |

### 6.2 No false confidence

- If only 2 skills exist in a category, show "top 2" not "top 3"
- If a field has no data, don't show it (don't fabricate)
- If online registry returns 0 results, skip the section entirely
- If a capability description would be generic ("Various skills"), skip that category

### 6.3 Garbage detection

Before displaying any field, check for:
- Single character descriptions (`>`, `-`, `|`, `>-`, `|-`)
- YAML frontmatter patterns (`--- name:`, `category:`, `tags:`)
- Empty or whitespace-only strings

If garbage detected, treat field as empty.

---

## File Changes

| File | Changes |
|------|---------|
| `scan-skills.js` | Fix YAML parser, strip frontmatter, add tags/summary/completeness, improve categorization |
| `skill-guide.js` | Redesign share page (hero → capability map → insights → CTA), redesign recommend page, dynamic capability descriptions, OG tags, garbage filtering |
| `skill-registry.js` | Use completeness in overlap ranking, fix popular URL filtering |
| `test/scan-skills.test.js` | Tests for multiline YAML, frontmatter stripping, tags, summary, completeness |
| `test/cli.test.js` | Tests for new share/recommend structure, OG tags, capability descriptions |
| `test/registry.test.js` | Tests for completeness-based ranking, URL filtering |

---

## Spec Self-Review

1. **Placeholder scan:** No TBD/TODO. All sections have concrete specifications.
2. **Internal consistency:** Completeness score defined once, used consistently. Capability descriptions defined once, used in both share and OG tags.
3. **Scope check:** Data layer + output redesign. No new CLI flags.
4. **Accuracy safeguards:** Explicit language rules, garbage detection, "no false confidence" rules. Address user's concern about misleading output.
5. **Research-backed:** 7-second rule, pain-first headline, "your turn" hook, visual proof — all grounded in growth research.
