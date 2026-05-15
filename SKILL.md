---
name: skill-guide
description: |
  Discover, understand, compare, and choose from installed Agent Skills across
  Claude Code, Codex, local skill folders, and plugin marketplaces. Generates
  HTML slide presentations with skill overviews, deep-dives, and tool
  recommendations. Use when user says "skill-guide", asks what skills they
  have, wants to explore Claude Code or Codex skills, asks "tell me about
  a skill", "which skill for X", "help me understand my skills", or wants to
  map installed agent capabilities.
allowed-tools:
  - Bash
  - Read
  - Write
---

# Skill Guide

## 1. When to Use

Activate this skill when the user wants to explore, discover, compare, or learn about their installed Agent Skills across Claude Code, Codex, local skill folders, and plugin marketplaces. The output is a polished HTML slide presentation opened in the browser.

**Trigger conditions:**
- User types `/skill-guide` (bare or with arguments)
- User asks "what skills do I have", "show me my skills", "what Codex skills do I have"
- User asks about a specific skill: "tell me about frontend-slides"
- User describes a task and wants to know which skill fits: "which skill for code review"
- User says "help me understand my skills"

## 2. Mode Detection

Determine the mode from user input:

| User Input | Mode | Scanner Flag |
|------------|------|-------------|
| `/skill-guide` (bare, no args) | discovery | `--list` |
| `/skill-guide <name>` or "tell me about <name>" | deep-dive | `--skill <name>` |
| Task description or "which skill for X" | tool-selection | `--search <query>` |
| `/skill-guide all` | full-manual | `--full` |

**Resolution rules (apply in order):**
1. If argument is "all" (case-insensitive) -> full-manual mode
2. If argument exactly matches a known skill name -> deep-dive mode
3. If argument contains verbs (e.g., "review", "build", "test") or question words ("which", "what", "how") -> tool-selection mode
4. If bare `/skill-guide` with no argument -> discovery mode

## 3. Workflow

Follow these steps exactly:

1. **Determine mode** from user input using the rules in section 2.
2. **Detect language**: Check user input for Chinese characters (`/[一-鿿]/`). If found, set `--lang zh`; otherwise omit (defaults to English).
3. **Run the deterministic CLI**: `node <skill-dir>/skill-guide.js <flag> [args] [--lang zh] --open`, where `<skill-dir>` is the directory containing this SKILL.md file.
4. Map modes to CLI flags:
   - Discovery: `node <skill-dir>/skill-guide.js --open`
   - Deep-dive: `node <skill-dir>/skill-guide.js --skill <name> --open`
   - Tool-selection: `node <skill-dir>/skill-guide.js --search "<query>" --open`
   - Full manual: `node <skill-dir>/skill-guide.js --full --open`
   - Diagnostics: `node <skill-dir>/skill-guide.js --doctor`
   Append `--lang zh` to any command when Chinese input is detected.
5. If `skill-guide.js` is unavailable, fall back to running `scan-skills.js` and generating HTML using the rules below.

## 4. HTML Generation Rules

### Technical Requirements

- Single-file HTML with all CSS and JS inlined. Zero external dependencies.
- Full-screen scroll-snap slides:
  ```css
  .slide {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    scroll-snap-align: start;
  }
  ```
- CSS custom properties with `clamp()` for responsive sizing.
- Keyboard navigation (arrow keys), scroll wheel, and touch swipe.
- IntersectionObserver for entrance animations: elements with class `.rv` get class `.v` added when visible.
- Navigation dots on the right side.
- Progress bar at the top.
- Page number: bottom-right corner as `<div class="sn-txt">N/total</div>`.
- `@media (prefers-reduced-motion: reduce)` disables animations.
- Every slide MUST fit within the viewport. If content overflows, split into multiple slides.

### Color Theme CSS Variables

```css
:root {
  --bg: #eef2ff;
  --card: #fff;
  --cs: 0 4px 20px rgba(100,100,180,0.07);
  --t: #1e293b;
  --ts2: #64748b;
  --ab: #818cf8;
  --ap: #f0abfc;
  --am: #6ee7b7;
  --ao: #fdba74;
  --ay: #fde047;
  --al: #c4b5fd;
  --ar: #fda4af;
  --as: #7dd3fc;
  --r: clamp(10px,1.8vw,18px);
}
```

Each slide gets a subtle gradient background and decorative blurred circles (pseudo-elements with `filter: blur(80px)`, low opacity, positioned absolutely) for atmosphere.

### Per-Mode Page Structure

#### Discovery Mode (4 pages)

**Page 1 - Cover:**
- Title: If scanner sources include both Claude and Codex, use "Your Agent Skills" (EN) or "你的 Agent Skills 技能库" (ZH). If only Claude sources are present, use "Your Claude Code Skills" / "你的 Claude Code 技能库". If only Codex sources are present, use "Your Codex Skills" / "你的 Codex 技能库".
- Subtitle: total skill count + per-source breakdown (e.g., "12 Claude skills, 8 Codex skills, 20 plugin skills")
- Decorative background with gradient and blurred circles

**Page 2 - Category Map:**
- Group skills by their `category` field
- 3-column card grid
- Each card shows: skill name, 1-line description, category badge (colored pill)
- Use distinct accent colors per category for visual separation

**Page 3 - Highlights:**
- Top 5-8 most versatile skills (ranked by number of triggers or multiple sources)
- Each highlight: skill name + full description + trigger words as small badges
- Use a prominent card layout with the accent color

**Page 4 - Quick Reference:**
- Table with columns: Name | Description | Triggers | Category
- Compact rows, alternating background for readability
- Sticky header if content is long

#### Deep-dive Mode (1-3 pages per skill)

**Page 1 - Overview:**
- Large skill name as title
- Full description as subtitle
- Category badge (colored pill)
- Source badge (showing where the skill comes from)
- List of `allowedTools` as code-styled tags

**Page 2 - How It Works:**
- Render `sections` array as a numbered step flow with circle numbers (1, 2, 3...)
- If `howItWorks` field exists, render it as a detail/expandable box
- Use connecting lines or arrows between steps for flow visualization

**Page 3 - When to Use:**
- `whenToUse` items as green "Use when..." tags
- `limitations` items as orange "Caution" tags
- `triggers` as keyword badges in a separate section
- If Page 2 + Page 3 content combined is short enough for one slide, merge them

#### Tool-selection Mode (2-3 pages)

**Page 1 - Match Results:**
- User's task description displayed as a quote/callout
- Matched skills ranked by relevance (count of trigger matches + description keyword overlap)
- Each match shows: name, relevance score, top matching triggers

**Page 2 - Side-by-side Comparison:**
- Top 2-3 matches in a comparison layout
- Columns: Feature | Skill A | Skill B | Skill C
- Rows: Description, Triggers, When to Use, Limitations, Tools

**Page 3 - Workflow Suggestion:**
- Flow diagram showing how skills can combine: Skill A -> Skill B -> Result
- Use CSS-only arrows between skill boxes
- Brief explanation of why this combination works

#### Full Manual Mode

**Page 1 - Cover:**
- Title: "Complete Skill Manual" / "完整技能手册"
- Total skill count + source breakdown

**Page 2 - Category Index:**
- Category names with skill count per category
- Clickable/visual index layout

**One page per skill (compact format):**
- Skill name as heading
- 2-line description
- Trigger words as badges
- When-to-use summary (1-2 lines)
- Keep each skill to one page maximum

**Last page - Quick Reference Table:**
- Same as Discovery Page 4 but covering all skills

**Overflow protection:** If total skills > 30, warn the user before generating: "This will produce N pages. Continue?" Then proceed only after confirmation.

### Content Mapping from JSON

Map scanner JSON fields to HTML content:

| JSON Field | HTML Section |
|-----------|-------------|
| `name` + `description` | Slide title, subtitle, card header |
| `howItWorks` | "How it works" detail box |
| `sections` | Numbered step flow |
| `whenToUse` + `triggers` | "When to use" tags + trigger keyword list |
| `limitations` | "Limitations" caution area |
| `allowedTools` | Tools list (collapsible, for advanced users) |
| `category` | Category badge, used for grouping and coloring |
| `source` | Source badge showing origin |

### Language Handling

Check user input for Chinese characters (`/[一-鿿]/`). If found:

| English Label | Chinese Label |
|--------------|---------------|
| Your Agent Skills | 你的 Agent Skills 技能库 |
| Your Claude Code Skills | 你的 Claude Code 技能库 |
| Your Codex Skills | 你的 Codex 技能库 |
| Category Map | 分类概览 |
| Highlights | 精选推荐 |
| Quick Reference | 快速参考 |
| How It Works | 运作原理 |
| When to Use | 何时使用 |
| Limitations | 使用限制 |
| Triggers | 触发词 |
| Complete Skill Manual | 完整技能手册 |
| Match Results | 匹配结果 |
| Comparison | 对比分析 |
| Workflow Suggestion | 工作流建议 |
| Use when... | 适用场景... |
| Caution | 注意 |
| Tools | 工具列表 |
| Source | 来源 |
| Category | 分类 |

Otherwise, use English labels throughout.

## 5. Anti-Patterns

- **Never fabricate skill descriptions.** Only use data returned by the scanner. If the scanner returns empty or fails, show an error slide instead of guessing.
- **Never skip running the scanner.** The scanner is the sole source of truth for installed skills.
- **Never generate more than 30 pages without asking.** Prompt the user first.
- **Never include skills without a name.** Skip malformed entries and log a warning to console.
- **Never hard-code skill lists.** Always derive from scanner output at generation time.
