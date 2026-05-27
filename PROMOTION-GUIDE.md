# skill-guide 发布与推广指南

## 第一步：npm 发布（必须你来做）

### 1. 登录 npm

在终端运行：
```bash
npm login
```
会提示输入用户名、密码、邮箱。如果没有 npm 账号，先去 https://www.npmjs.com/signup 注册。

### 2. 发布

```bash
cd /Users/huangmingpeng/AIProjects/skill-guide
npm publish
```

发布成功后，任何人都可以运行 `npx skill-guide --open`。

### 3. 验证

```bash
npm view skill-guide
```

---

## 第二步：提交 awesome-list PR（你来提交，内容已准备好）

### PR 1: ComposioHQ/awesome-claude-skills（60K stars）

1. 打开 https://github.com/ComposioHQ/awesome-claude-skills
2. 点 Fork
3. 在你 fork 的仓库中编辑 README.md
4. 找到 **"Development & Code Tools"** 部分
5. 在 Skill Creator 和 Skill Seekers 之间（按字母顺序）插入：

```
- [skill-guide](https://github.com/gtskevin/skill-guide) - Zero-dependency CLI that scans Claude Code, Codex, cc-switch, and plugin skill directories to generate visual HTML presentations of installed skills. *By [@gtskevin](https://github.com/gtskevin)*
```

6. Commit: `Add skill-guide CLI to Development & Code Tools`
7. 创建 PR，标题：`Add skill-guide skill`

### PR 2: ComposioHQ/awesome-codex-skills（10K stars）

同上流程，编辑 README.md，找 **"Meta & Utilities"** 部分，插入：

```
- [skill-guide](https://github.com/gtskevin/skill-guide) - Zero-dependency CLI that scans Claude Code, Codex, cc-switch, and plugin skill directories, then generates HTML slide presentations showing what skills are installed.
```

### PR 3: travisvn/awesome-claude-skills（13K stars）

**等你的 repo 到 10+ stars 后再提交**（他们的 CONTRIBUTING.md 要求）。

找表格，插入一行：

```
| **[skill-guide](https://github.com/gtskevin/skill-guide)** | Zero-dependency CLI that scans skill directories across Claude Code, Codex, cc-switch, and plugins to generate visual HTML presentations of installed skills |
```

---

## 第三步：社区分享（复制粘贴即可）

### Reddit r/ClaudeAI

**标题：**
```
I made a CLI that scans all your installed skills and generates beautiful HTML slides — skill-guide
```

**正文：**
```markdown
I was frustrated that I had 200+ skills installed across Claude Code, Codex, and plugins but only used a handful. So I built **skill-guide** — a zero-dependency CLI that scans everything and generates a visual slide deck.

**One command:**
```
npx skill-guide --open
```

**What it does:**
- Scans Claude Code, Codex, cc-switch, and plugin directories
- Auto-categorizes into 9 categories
- Generates scroll-snap HTML slides with keyboard navigation
- Supports search, deep-dive on individual skills, and diagnostics

**Live demo:** https://gtskevin.github.io/skill-guide/

**GitHub:** https://github.com/gtskevin/skill-guide

No npm install needed. Zero dependencies. MIT license.
```

### Hacker News

**标题：** `skill-guide: Map your installed AI agent skills in one command`
**URL:** `https://github.com/gtskevin/skill-guide`

### X/Twitter

```
I built skill-guide — a zero-dependency CLI that scans all your Claude Code, Codex, and plugin skills, then generates beautiful HTML slides.

200+ skills installed but only use 3? Not anymore.

npx skill-guide --open

GitHub: https://github.com/gtskevin/skill-guide
```

---

## 第四步：后续可选

- **提交到 Anthropic 官方插件目录：** https://clau.de/plugin-directory-submission（需要先包装成 plugin 格式）
- **hesreallyhim/awesome-claude-code（44K stars）：** 正在重构中，几周后再提交
- **录制 30 秒 demo 视频：** 用屏幕录制工具录 `npx skill-guide --open` 的过程，比 GIF 传播力强 5-10 倍
