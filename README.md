<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=skill-guide&fontSize=42&fontColor=fff&animation=fadeIn&fontAlignY=32&desc=Map%20your%20Agent%20Skills&descSize=18&descAlignY=52" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Claude%20Code%20%7C%20Codex-818cf8?style=flat-square" />
  <img src="https://img.shields.io/github/actions/workflow/status/gtskevin/skill-guide/test.yml?branch=main&style=flat-square&label=test" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Zero%20Dependencies-Node.js-6ee7b7?style=flat-square" />
  <img src="https://img.shields.io/badge/Output-HTML%20Slides-f0abfc?style=flat-square" />
  <img src="https://img.shields.io/badge/Language-EN%20%7C%20%E4%B8%AD%E6%96%87-7dd3fc?style=flat-square" />
</p>

> **200+ agent skills installed but you only use 3?** skill-guide scans Claude Code, Codex, and plugin skill folders, then generates beautiful HTML presentations — so you actually know what you have, how it works, and when to use it.

<p align="center">
  <a href="https://gtskevin.github.io/skill-guide/"><strong>Live Demo</strong></a>
  ·
  <a href="demo.html">Download Demo</a>
  ·
  <a href="#quick-start">Try with your skills</a>
</p>

<p align="center">
  <img src="demo.gif" alt="skill-guide demo showing Agent Skills slides" width="760" />
</p>

## What it does

skill-guide reads every skill from Claude Code, Codex, `~/.cc-switch/skills/`, and plugin marketplaces, then generates a polished slide deck you can view in any browser.

**4 modes:**

| Mode | Command | Output |
|------|---------|--------|
| **Discovery** | `/skill-guide` or `npx skill-guide --open` | Stats, category map, highlights, quick reference |
| **Deep-dive** | `/skill-guide investigate` or `npx skill-guide --skill investigate --open` | How it works, when to use, limitations, triggers |
| **Tool-selection** | "Which skill for security?" | Ranked recommendations with comparison |
| **Full manual** | `/skill-guide all` or `npx skill-guide --full --open` | One page per skill, complete reference |
| **Doctor** | `npx skill-guide --doctor` | Environment and source diagnostics |

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

## Quick Start

**1. Try instantly**
```bash
npx skill-guide --open
```

**2. Or install for Claude Code**
```bash
npx skills add gtskevin/skill-guide
```

**Or install for Codex**
```bash
git clone https://github.com/gtskevin/skill-guide.git
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$(pwd)/skill-guide" "${CODEX_HOME:-$HOME/.codex}/skills/skill-guide"
```

**3. Run in Claude Code or Codex**
```
/skill-guide
```

**4. View** — HTML slides open in your browser automatically.

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

## How it works

```
skill-guide/
├── SKILL.md             # Skill definition + HTML generation rules
├── agents/openai.yaml   # Codex/OpenAI skill UI metadata
├── skill-guide.js        # Deterministic CLI + HTML generator
├── scan-skills.js       # Zero-dependency Node.js scanner
├── demo.html            # Demo presentation (this is what you see above)
└── LICENSE              # MIT
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
| `--doctor` | Check paths, sources, and scan counts |

### Doctor checks

`npx skill-guide --doctor` reports Node.js version, Claude Code and Codex skill paths, source counts, duplicate skill names, malformed skill files, and suggested install paths.

### Auto-categorization

Skills are automatically sorted into 9 categories: `testing`, `design`, `security`, `documentation`, `automation`, `deployment`, `code-quality`, `development`, `other`.

## Language Support

Automatic — ask in Chinese, get Chinese output. Ask in English, get English output. No configuration needed.

## Why skill-guide?

- **The only skill that maps your skills** — scans Claude Code, Codex, cc-switch, and plugin sources in one visual overview
- **Zero dependencies** — pure Node.js with `fs`, `path`, `os`. No npm install needed
- **Beautiful output** — scroll-snap slides with keyboard nav, animations, and responsive design
- **Bilingual** — Chinese and English auto-detected from your input
- **Smart caching** — 5-minute TTL so repeated queries are instant
- **GitHub-ready** — CI, GitHub Pages demo, social preview, and topic metadata included

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

---

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" />
</p>
