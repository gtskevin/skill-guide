<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=skill-guide&fontSize=42&fontColor=fff&animation=fadeIn&fontAlignY=32&desc=Know%20your%20Claude%20Code%20skills&descSize=18&descAlignY=52" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Claude%20Code-818cf8?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Zero%20Dependencies-Node.js-6ee7b7?style=flat-square" />
  <img src="https://img.shields.io/badge/Output-HTML%20Slides-f0abfc?style=flat-square" />
  <img src="https://img.shields.io/badge/Language-EN%20%7C%20%E4%B8%AD%E6%96%87-7dd3fc?style=flat-square" />
</p>

> **200+ skills installed but you only use 3?** skill-guide scans all your Claude Code skills and generates beautiful HTML presentations — so you actually know what you have, how it works, and when to use it.

## What it does

skill-guide reads every skill from your `~/.claude/skills/`, `~/.cc-switch/skills/`, and plugin marketplaces, then generates a polished slide deck you can view in any browser.

**4 modes:**

| Mode | Command | Output |
|------|---------|--------|
| **Discovery** | `/skill-guide` | Stats, category map, highlights, quick reference |
| **Deep-dive** | `/skill-guide investigate` | How it works, when to use, limitations, triggers |
| **Tool-selection** | "Which skill for security?" | Ranked recommendations with comparison |
| **Full manual** | `/skill-guide all` | One page per skill, complete reference |

## Screenshots

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

**1. Install**
```bash
npx skills add gtskevin/skill-guide
```

**2. Run**
```
/skill-guide
```

**3. View** — HTML slides open in your browser automatically.

## Install Methods

```bash
# Method 1: npx skills (recommended)
npx skills add gtskevin/skill-guide

# Method 2: Manual symlink
git clone https://github.com/gtskevin/skill-guide.git
ln -s $(pwd)/skill-guide ~/.claude/skills/skill-guide

# Method 3: Direct download
mkdir -p ~/.claude/skills/skill-guide
curl -sL https://github.com/gtskevin/skill-guide/archive/refs/heads/main.tar.gz | tar xz --strip-components=1 -C ~/.claude/skills/skill-guide
```

## Usage Examples

### Discover all your skills
```
/skill-guide
```
Or say: "What skills do I have?" / "帮我看看我有哪些技能"

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
├── SKILL.md          # Skill definition + HTML generation rules
├── scan-skills.js    # Zero-dependency Node.js scanner
├── demo.html         # Demo presentation (this is what you see above)
└── LICENSE           # MIT
```

1. `scan-skills.js` scans 3 skill directories, parses YAML frontmatter, extracts sections and key paragraphs
2. `SKILL.md` reads the JSON and generates HTML slides with scroll-snap navigation, keyboard controls, and animations
3. Output opens in your browser — zero config, zero dependencies

### Scanner modes

| Flag | Purpose | Data |
|------|---------|------|
| `--list` | Discovery | Name + description + category |
| `--skill <name>` | Deep-dive | Full metadata + sections + key paragraphs |
| `--search <query>` | Recommendations | Matching skills with full data |
| `--full` | Complete manual | All skills with full data |
| `--refresh` | Force re-scan | Ignores 5-min cache |

### Auto-categorization

Skills are automatically sorted into 9 categories: `testing`, `design`, `security`, `documentation`, `automation`, `deployment`, `code-quality`, `development`, `other`.

## Language Support

Automatic — ask in Chinese, get Chinese output. Ask in English, get English output. No configuration needed.

## Why skill-guide?

- **The only skill that maps your skills** — no other tool scans all 3 skill sources and generates visual overviews
- **Zero dependencies** — pure Node.js with `fs`, `path`, `os`. No npm install needed
- **Beautiful output** — scroll-snap slides with keyboard nav, animations, and responsive design
- **Bilingual** — Chinese and English auto-detected from your input
- **Smart caching** — 5-minute TTL so repeated queries are instant

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

---

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" />
</p>
