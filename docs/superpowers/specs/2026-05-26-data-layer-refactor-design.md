# Data Layer Refactor Design

> **状态：** 设计中
> **日期：** 2026-05-26

## Goal

Refactor the skill data layer to fix parsing bugs, improve data quality, and provide richer structured data that makes share/recommend outputs genuinely useful and trustworthy.

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

**Purpose:** Measures how much useful data a skill provides. Used to rank top picks and recommend which skills to keep in overlap alerts.

**Scoring rules (conservative, verifiable):**

| Field | Points | Condition |
|-------|--------|-----------|
| description | 20 | Non-empty AND not a YAML artifact (`>`, `>-`, `\|-`, etc.) |
| summary | 20 | Non-empty |
| whenToUse | 20 | Non-empty AND does not start with `---` |
| howItWorks | 10 | Non-empty AND does not contain `category:` or `tags:` |
| tags | 10 | Array with length > 0 |
| triggers | 10 | Array with length > 0 |
| limitations | 10 | Non-empty |

**Important:** The score is deliberately conservative. A skill with only a description gets 20/100. This prevents misleading users into thinking a poorly-documented skill is "good."

**Validation:** Each field check includes a "garbage detection" filter — if the content looks like YAML metadata, it gets 0 points for that field.

---

## Section 3: Improved Categorization

### 3.1 Use tags for better category assignment

**Current:** Pure keyword regex on name + description text.
**Improved:** If `tags` are available, use them as primary signal. Fall back to text matching only when tags are empty.

**Priority order:**
1. `tags` array matches a category's keywords
2. `description` text matches category keywords
3. `name` text matches category keywords
4. Default to `other`

### 3.2 Reduce "other" bloat

**Current:** 123/340 skills (36%) fall into "other".
**Target:** <20% in "other" after using tags.

**Why this matters:** The radar chart is dominated by "other", making it visually meaningless. Reducing "other" makes the chart actually useful.

---

## Section 4: Output Improvements (Share Page)

### 4.1 Top picks selection

**Current:** First 5 skills that have `whenToUse` or `howItWorks` or `sections`.
**Improved:** Sort by `completeness` descending, take top 5.

**Rationale:** This ensures the showcase skills have the richest data. A skill with 95/100 completeness will have description, summary, whenToUse, tags — enough to create a compelling card.

### 4.2 Top pick cards

**Current:** Name + truncated description.
**Improved:** Name + summary (or description fallback) + triggers (if any) + tags (if any).

**Example:**
```
careful
Safety guardrails for destructive commands. When active, warns
before executing rm -rf, DROP TABLE, git push --force...

Triggers: be careful, warn before destructive, safety mode
Tags: safety, git, destructive
```

### 4.3 Category cards — "other" cap

**Current:** Shows all skills in every category (123 in "other").
**Improved:** Show first 10 skills per category, then "+ N more" for overflow.

### 4.4 Radar chart — more meaningful

**Current:** "other" dominates at 36%.
**Improved:** After better categorization, "other" should be <20%. The chart shows real skill distribution.

---

## Section 5: Output Improvements (Recommend Page)

### 5.1 Overlap alert — "top 3" recommendation

**Current:** "You have 33 skills in security. Consider keeping only the most-used one."
**Improved:** "Your top 3 in security:" then list the 3 skills with highest `completeness`, with scores.

**Example:**
```
security (33 skills)
Your top 3:
  1. security-audit (95/100)
  2. django-security (88/100)
  3. laravel-security (82/100)

Based on documentation completeness.
```

**Accuracy guarantee:** The completeness score is a measure of documentation quality, NOT skill quality. The recommendation text must clearly state this: "based on documentation completeness" not "best skills."

### 5.2 Popular skills — real URLs

**Current:** Links to `example.com`.
**Improved:** Use actual URLs from the awesome-list data. If URL is missing or invalid, don't show a link.

### 5.3 Gap analysis — richer recommendations

**Current:** "Add a TDD skill to catch bugs before they ship" + generic online skill links.
**Improved:** Same action hint, but recommended skills show their `summary` if available.

---

## Section 6: Accuracy Safeguards

### 6.1 Completeness score disclaimers

The completeness score is about **documentation quality**, not **skill quality**. All user-facing text must reflect this:

- ✅ "based on documentation completeness"
- ✅ "most documented skills"
- ❌ "best skills"
- ❌ "top skills"

### 6.2 No false confidence

- If only 2 skills exist in a category, don't show "top 3" — show "top 2"
- If a recommended skill has no summary, show description only (don't fabricate)
- If online registry returns 0 results, don't show the popular section at all

### 6.3 Garbage detection

Before displaying any field, check for known garbage patterns:
- Single character descriptions (`>`, `-`, `|`)
- YAML frontmatter patterns (`--- name:`, `category:`, `tags:`)
- Empty or whitespace-only strings

If garbage is detected, treat the field as empty.

---

## File Changes

| File | Changes |
|------|---------|
| `scan-skills.js` | Fix YAML parser, strip frontmatter, add tags/summary/completeness, improve categorization |
| `skill-guide.js` | Update top picks sorting, overlap "top 3", category card cap, garbage filtering |
| `skill-registry.js` | Use completeness in recommend output |
| `test/scan-skills.test.js` | Add tests for multiline YAML, frontmatter stripping, tags, summary, completeness |
| `test/cli.test.js` | Update integration tests for new output format |
| `test/registry.test.js` | Update recommend tests for completeness-based ranking |

---

## Spec Self-Review

1. **Placeholder scan:** No TBD/TODO. All sections have concrete specifications.
2. **Internal consistency:** The completeness score is defined once and used consistently in share top picks and recommend overlap.
3. **Scope check:** This is focused on data layer + output improvements. No new CLI flags or modes.
4. **Ambiguity check:** The scoring rules are explicit with point values. The accuracy safeguards section addresses the user's concern about misleading recommendations.
