<p align="center">
  <img src="https://img.shields.io/badge/Zero%20Dependencies-Node.js-6ee7b7?style=flat-square" />
  <img src="https://img.shields.io/badge/Output-HTML%20Slides-f0abfc?style=flat-square" />
  <img src="https://img.shields.io/badge/Platform-Claude%20Code%20%7C%20Codex%20%7C%20cc--switch-818cf8?style=flat-square" />
  <img src="https://img.shields.io/github/actions/workflow/status/gtskevin/skill-guide/test.yml?branch=main&style=flat-square&label=tests" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Language-English%20%7C%20Chinese-7dd3fc?style=flat-square" />
  <img src="https://img.shields.io/badge/Feature-Health%20Dashboard-fbbf24?style=flat-square" />
</p>

<p align="center">
  <img src="demo.gif" alt="skill-guide demo — npx skill-guide --open generates HTML slides" width="760" />
</p>

> **Installed so many agent skills that you cannot remember what you have?**
> One command scans everything — Claude Code, Codex, cc-switch, plugins — and generates a beautiful dashboard so you actually know what you have.
>
> Shows your local skill profile, radar chart, token budget estimate, and review candidates — all in one click.

<p align="center">
  <a href="https://gtskevin.github.io/skill-guide/"><strong>Live Demo</strong></a>
  ·
  <a href="#quick-start">Try it now</a>
  ·
  <a href="#install-methods">Install</a>
  ·
  <a href="#how-it-works">How it works</a>
</p>

```bash
npx skill-guide               # ← that's it. Dashboard opens in your browser.
```

## What it does

skill-guide reads every skill from Claude Code, Codex, `~/.cc-switch/skills/`, and plugin marketplaces, then generates a polished dashboard you can view in any browser.

**Platform-aware:** Automatically detects whether you're running inside Codex or Claude Code and shows only the relevant skills. Token budget is calculated per-platform, not across all platforms.

**3 modes:**

| Mode | Command | What it does |
|------|---------|-------------|
| **Dashboard** | `npx skill-guide` | Personality, radar, token budget, cleanup guide, highlights |
| **Find** | `npx skill-guide --find <name\|query>` | Search by keyword or deep dive into a specific skill |
| **Doctor** | `npx skill-guide --doctor` | Environment diagnostics (broken files, duplicates, paths) |

**Flags:**
- `--all` — Show skills from all platforms (default: current platform only)
- `--full` — Expand dashboard to include all skill details
- `--recommend` — Show recommendations from online directories
- `--share` — Generate shareable portfolio page
- `--no-open` — Do not open HTML in browser

## Platform Support

| Platform | Status | Scanned paths |
|----------|--------|---------------|
| **Claude Code** | Supported | `~/.claude/skills`, `~/.claude/plugins/marketplaces` |
| **Codex** | Supported | `~/.codex/skills`, `$CODEX_HOME/skills`, Codex plugin cache |
| **OpenAI system skills** | Supported | `$CODEX_HOME/skills/.system` as a separate source |
| **cc-switch** | Supported | `~/.cc-switch/skills` |
| **Agent Skills** | Compatible | Standard `SKILL.md` skill folders |

## Screenshots

![skill-guide social preview](social-preview.png)

<table>
  <tr>
    <td><img src="demo-cover.png" alt="Cover slide" width="400" /></td>
    <td><img src="demo-categories.png" alt="Category map" width="400" /></td>
  </tr>
  <tr>
    <td align="center"><em>Cover — total count & sources</em></td>
    <td align="center"><em>Category map — grouped cards</em></td>
  </tr>
  <tr>
    <td><img src="demo-highlights.png" alt="Top picks" width="400" /></td>
    <td><img src="demo-reference.png" alt="Quick reference" width="400" /></td>
  </tr>
  <tr>
    <td align="center"><em>Top picks — best skills</em></td>
    <td align="center"><em>Quick reference table</em></td>
  </tr>
</table>

### Health Dashboard Preview

```bash
npx skill-guide
```

**Terminal output:**
```
🟡 Health Score: 68/100
🏛️ Local profile: Collector (The Collector)
The local scan found a large skill inventory. Review descriptions, sources, and actual needs periodically.

📦 Total Skills: 338
🔤 Description Token Estimate: ~20.0K (9.98% of a 200K reference context)
📍 Local profile: based only on the current scan

🛡️ Security Review [medium]
   Review skills with security flags manually
📦 Budget Overage [high]
   Review longer descriptions when the local reference budget is exceeded

Token Efficiency ████████░░ 80/100
Organization ██████████ 100/100
Security ████░░░░░░ 40/100
Freshness ██████████ 100/100
Budget Control ██░░░░░░░░ 21/100
```

Health scores are local heuristics for review. They do not measure community rank, actual usage frequency, or whether deleting a skill is safe.

## Quick Start

**1. Try instantly** — no install needed:
```bash
npx skill-guide --open
```

**2. Install for Claude Code:**
```bash
npx skills add gtskevin/skill-guide
```

**3. Use it** — type `/skill-guide` in Claude Code, or use the CLI:
```bash
npx skill-guide                               # See your dashboard
npx skill-guide --find security               # Find skills for a task
npx skill-guide --find tdd                    # Deep-dive one skill
npx skill-guide --full --open                 # Generate a full manual
npx skill-guide --doctor                      # Diagnose your setup
```

## Install Methods

```bash
# Claude Code: npx skills (recommended)
npx skills add gtskevin/skill-guide

# Claude Code: manual symlink
git clone https://github.com/gtskevin/skill-guide.git
ln -s $(pwd)/skill-guide ~/.claude/skills/skill-guide

# Claude Code: direct download
mkdir -p ~/.claude/skills/skill-guide
curl -sL https://github.com/gtskevin/skill-guide/archive/refs/heads/main.tar.gz | tar xz --strip-components=1 -C ~/.claude/skills/skill-guide

# Codex: manual symlink
git clone https://github.com/gtskevin/skill-guide.git
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$(pwd)/skill-guide" "${CODEX_HOME:-$HOME/.codex}/skills/skill-guide"
```

## Usage Examples

### Run as a CLI
```bash
npx skill-guide --open
npx skill-guide --search security --open
npx skill-guide --skill test-driven-development --open
npx skill-guide --share --open                    # Share your skill stack
npx skill-guide --recommend --open                # Review directory mentions and same-category candidates
npx skill-guide                   # Health dashboard with personality & radar chart
npx skill-guide --wrapped --open                  # Compatibility alias for the local profile
npx skill-guide --format json
npx skill-guide --doctor
```

### Discover all your skills
```
/skill-guide
```
Or say: "What skills do I have?" / "帮我看看我有哪些技能"

In Codex, you can also say: "What Codex skills do I have?"

### Deep-dive one skill
```
/skill-guide investigate
```
Or say: "Tell me about the TDD skill" / "介绍一下 investigate 技能"

### Find the right skill
```
Which skill should I use for code review?
```
Or: "帮我推荐一个做测试的技能"

### Generate a full manual
```
/skill-guide all
```

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

### Health check your skills
```bash
npx skill-guide                   # Full HTML dashboard
npx skill-guide --health                          # Terminal output
npx skill-guide --health --lang zh --open         # Chinese UI
```

**What you get:**
- **Health Score** — 0-100 rating of your skill library's health
- **Personality Analysis** — Are you a Collector, Minimalist, Security Expert, or Specialist?
- **Five-Dimension Radar Chart** — Token Efficiency, Organization, Security, Freshness, Budget Control
- **Review Prompts** — Local candidates based on scanned skill metadata
- **Token Estimate** — Approximate description cost before a conversation starts
- **One-Click Share** — Copy report to clipboard for sharing

### Personal Skill Report (--wrapped)

Your local profile for AI skills:
- Skill personality type (Collector, Minimalist, Security Expert, etc.)
- Skill DNA breakdown (category distribution)
- Readiness breakdown based on local metadata
- Shareable HTML report with one-click copy

## How it works

```
skill-guide/
├── SKILL.md              # Natural-language CLI entrypoint
├── agents/openai.yaml    # Codex/OpenAI skill UI metadata
├── skill-guide.js        # Deterministic CLI + HTML generator
├── scan-skills.js        # Zero-dependency Node.js scanner
├── skill-registry.js     # Online directory fetching + recommendation engine
├── demo.html             # Demo presentation (this is what you see above)
└── LICENSE               # MIT
```

1. `scan-skills.js` scans Claude Code, Codex, cc-switch, and plugin skill directories; parses YAML frontmatter; extracts sections and key paragraphs
2. `skill-guide.js` turns scanner JSON into deterministic HTML slides with scroll-snap navigation, keyboard controls, and animations
3. `SKILL.md` lets Claude Code and Codex invoke the same CLI from natural language
4. Output opens in your browser — zero config, zero dependencies

### Scanner modes

| Flag | Purpose | Data |
|------|---------|------|
| `--list` | Discovery | Name + description + category |
| `--skill <name>` | Deep-dive | Full metadata + sections + key paragraphs |
| `--search <query>` | Recommendations | Matching skills with full data |
| `--full` | Complete manual | All skills with full data |
| `--refresh` | Force re-scan | Ignores 5-min cache |

### CLI flags

| Flag | Purpose |
|------|---------|
| `--open` | Open the generated HTML in your browser |
| `--output <file>` | Save HTML to a specific path |
| `--format html,json` | Choose HTML slides or raw scanner JSON |
| `--search <query>` | Generate recommendations for a task |
| `--skill <name>` | Generate a deep-dive for one skill |
| `--full` | Generate a complete manual |
| `--share` | Generate a shareable portfolio HTML |
| `--user <name>` | Add personalized tag to share page |
| `--recommend` | Show directory mentions and same-category review candidates |
| `--health` | Generate health dashboard with local profile, radar chart, and review prompts |
| `--lang <code>` | UI language (`en` or built-in `zh`) |
| `--doctor` | Check paths, sources, and scan counts |

### Doctor checks

`npx skill-guide --doctor` reports Node.js version, Claude Code and Codex skill paths, source counts, duplicate skill names, malformed skill files, and suggested install paths.

### Auto-categorization

Skills are automatically sorted into 9 categories: `testing`, `design`, `security`, `documentation`, `automation`, `deployment`, `code-quality`, `development`, `other`.

## Language Support

Dashboard labels are available in English and Chinese. Agents can summarize results in the user's language without modifying the generated HTML.

- **English** — default
- **Chinese** — built-in (`--lang zh`)
- **Other languages** — agent summary in the user's language; dashboard labels remain English

## Why skill-guide?

- **Cross-platform inventory** — scans Claude Code, Codex, cc-switch, and plugin sources in one visual overview
- **Health dashboard** — local profile, radar chart, and review prompts for your skill library
- **Zero dependencies** — pure Node.js with `fs`, `path`, `os`. No `npm install` needed
- **Beautiful output** — scroll-snap slides with keyboard nav, animations, and responsive design
- **Bilingual dashboard** — English by default, with built-in Chinese labels via `--lang zh`
- **Smart caching** — 5-minute TTL so repeated queries are instant
- **5 seconds to "wow"** — `npx skill-guide --open` is all you need

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roadmap

- [x] `--share` — generate a shareable standalone HTML or Markdown summary
- [x] `--health` — health dashboard with local profile, radar chart, and review prompts
- [ ] Gemini CLI skill scanning (`~/.gemini/skills`)
- [ ] `--diff` — show recently added/removed skills since last scan
- [ ] `--export markdown` — output a Markdown table for pasting into issues and docs

Have an idea? [Open a feature request](https://github.com/gtskevin/skill-guide/issues/new?template=feature_request.yml).

## License

MIT
