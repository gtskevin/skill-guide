# skill-guide: Share & Recommend 功能设计

**日期：** 2026-05-26
**状态：** **设计中**

---

## 一、目标与动机

### 核心问题

skill-guide 当前是一个**一次性查看工具**——用户跑一次 `npx skill-guide --open`，看完就不再用了。这导致：

- 使用频率极低（1/5）
- 没有增长飞轮（用户不会主动传播）
- GitHub stars 停留在个位数

### 解决方案

新增两个功能，形成**增长飞轮**：

```
--recommend → 发现新 skill → 安装更多 → skill-guide 更有价值
--share     → 展示 skill 栈 → 社交传播 → 新用户安装 skill-guide
```

### 成功标准

| 指标 | 当前 | 目标（1 个月后） |
|------|------|----------------|
| GitHub Stars | 1 | 100+ |
| npm 周下载 | ~0 | 500+ |
| 使用频率 | 一次性 | 每周至少 1 次 |

---

## 二、整体架构

### 三层架构

```
scan-skills.js        → 本地扫描层（已有，不修改）
skill-registry.js     → 注册表层（新增，核心引擎）
skill-guide.js        → 展示层（已有，扩展 --share 和 --recommend 渲染）
```

### 数据流

```
--share:
  scan-skills.js → 已安装 skill 列表
  skill-guide.js → 生成独立 HTML（你的 skill 栈展示页）
                   带 "Install skill-guide" CTA 按钮（增长飞轮）

--recommend:
  scan-skills.js → 已安装 skill 列表
  skill-registry.js → 在线目录 + 重叠检测 + 空白分析
  skill-guide.js → 生成推荐报告（HTML 或终端输出）
```

---

## 三、skill-registry.js 详细设计

### 职责

skill-registry.js 是 skill 的元数据中心，负责：

1. **在线目录获取** — 从 GitHub awesome-list 拉取已知 skill 列表
2. **内容指纹** — 对已安装 skill 的 description + 关键 section 做哈希
3. **推荐引擎** — 对比"已安装"和"在线目录"，输出推荐结果
4. **缓存** — 在线目录数据缓存 1 小时

### 数据结构

```javascript
// 在线目录条目
{
  name: "tdd",
  description: "Test-Driven Development workflow...",
  url: "https://github.com/...",
  source: "awesome-claude-skills",
  category: "testing",
  popularity: "high"  // 基于在多少个 awesome-list 中出现
}

// 推荐结果
{
  type: "gap" | "overlap" | "popular",
  category: "security",
  message: "You have no security skills installed",
  skills: [ { name: "...", description: "...", url: "..." } ]
}
```

### 在线目录来源

| 来源 | URL | 格式 | 条目数（估计） |
|------|-----|------|---------------|
| awesome-claude-skills | GitHub raw README | Markdown 列表/表格 | ~100-200 |
| awesome-codex-skills | GitHub raw README | Markdown 列表/表格 | ~50-100 |

解析逻辑：用正则匹配 Markdown 中的 `- [name](url) - description` 和表格行 `| name | description |`。

### 推荐算法

```
1. 获取在线目录 → 去重 → 按 category 分组
2. 获取已安装 skill → 按 category 分组
3. 生成推荐：
   gap:     在线有但本地没有的 category → 推荐该 category 的热门 skill
   overlap: 本地同一 category 有 3+ 个 skill → 提示"你有 3 个 TDD skill，考虑精简"
   popular: 在线目录中出现频率最高的 skill，本地没装 → 推荐
4. 排序：gap > popular > overlap
```

### 缓存策略

- 在线目录：缓存到 `/tmp/claude/skill-registry-cache.json`，TTL 1 小时
- 缓存 key：SHA1 of awesome-list URLs
- `--refresh` 标志跳过缓存（复用 scan-skills 的现有逻辑）

### API 设计

```javascript
// 导出函数
module.exports = {
  fetchRegistry,    // 获取在线目录（带缓存）
  analyzeInstalled, // 分析已安装 skill 的内容指纹
  recommend,        // 生成推荐结果
  clearCache        // 清除缓存
};

// 使用示例
const registry = require('./skill-registry');
const installed = scanSkills(); // 从 scan-skills.js 获取
const recommendations = registry.recommend(installed);
```

---

## 四、--share 功能设计

### CLI 接口

```bash
npx skill-guide --share                    # 生成 HTML，终端显示文件路径
npx skill-guide --share --open             # 生成并打开
npx skill-guide --share --output ~/my-skills.html  # 指定输出路径
npx skill-guide --share --user @gtskevin   # 个性化标签
```

### HTML 页面结构

这是一张**你的 AI 编程技能名片**，风格类似 GitHub profile README，但更精美：

**结构：**

1. **Hero 区** — 标题 "My AI Skill Stack" + 技能总数 + 分类数
2. **分类卡片** — 每个分类一个卡片，列出该分类下的 skill 名称和一句话描述
3. **精选推荐** — 你最值得用的 3-5 个 skill（基于 section 完整度）
4. **底部 CTA** — "Powered by skill-guide" + 安装命令 `npx skill-guide --open`

**视觉风格：**

- 复用现有暗色主题 + 渐变背景
- 卡片式布局，响应式设计
- 顶部有可选的 "Shared by @username" 个性化标签

**增长飞轮设计：**

- 底部 CTA 是核心——看到别人分享的 skill 栈，想自己也装一个
- 每个 skill 名称可点击（链接到 GitHub repo）
- 页面带 `<meta>` 标签，支持社交媒体预览（og:title, og:description）

### 与现有模式的关系

| 模式 | 用途 | 输出 |
|------|------|------|
| `--list` | 发现 | Stats + category map |
| `--skill` | 深入 | 单个 skill 详情 |
| `--search` | 选择 | 推荐列表 |
| `--full` | 完整手册 | 所有 skill 详情 |
| `--share` | **分享** | **你的 skill 栈名片** |
| `--recommend` | **推荐** | **个性化推荐报告** |

---

## 五、--recommend 功能设计

### CLI 接口

```bash
npx skill-guide --recommend                    # 终端输出推荐
npx skill-guide --recommend --open             # HTML 报告
npx skill-guide --recommend --format json      # JSON 输出（给 agent 用）
```

### 终端输出设计

```
┌─ skill-guide recommend ─────────────────────┐
│                                              │
│  📊 Your skill stack: 23 skills, 7/9 categories covered │
│                                              │
│  ⚠️  Gaps (2 categories with no skills):    │
│    • security — 0 skills installed           │
│      → Try: security-audit, code-review      │
│                                              │
│    • deployment — 0 skills installed         │
│      → Try: vercel-deploy, docker-patterns   │
│                                              │
│  🔥 Popular you're missing:                  │
│    • tdd (used by 40% of community)          │
│    • frontend-design (used by 35%)           │
│                                              │
│  📋 Overlap alert:                           │
│    • You have 3 skills in "testing" category │
│      Consider keeping only the most-used one │
│                                              │
└──────────────────────────────────────────────┘
```

### HTML 报告结构

1. **概览** — 你的 skill 栈统计（总数、分类覆盖、与社区平均对比）
2. **空白分析** — 缺失的分类，每个分类推荐 2-3 个热门 skill（带描述和链接）
3. **重叠检测** — 同一分类下多个 skill 的功能对比，建议精简
4. **热门推荐** — 社区最受欢迎的 10 个 skill，你还没装的
5. **底部 CTA** — 同 share，带安装命令

### 推荐理由设计

每条推荐必须解释**为什么**：

```
✅ 好的推荐理由：
"You have 0 security skills. Security-audit scans code for OWASP top 10 vulnerabilities."

❌ 差的推荐理由：
"Try security-audit"（没有上下文）
```

---

## 六、文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `skill-registry.js` | 新增 | 注册表层，~300-400 行 |
| `skill-guide.js` | 修改 | 新增 `--share` 和 `--recommend` 渲染 |
| `SKILL.md` | 修改 | 新增 share 和 recommend 模式说明 |
| `package.json` | 修改 | 版本号 0.3.0 |
| `README.md` | 修改 | 新增 share 和 recommend 文档 |
| `test/registry.test.js` | 新增 | 注册表单元测试 |
| `test/cli.test.js` | 修改 | 新增 share 和 recommend 集成测试 |

### 不修改的文件

- `scan-skills.js` — 保持现有扫描逻辑不变
- `bin/skill-guide` — 入口不变（已 require skill-guide.js）

---

## 七、约束与限制

### 保持的约束

- **零依赖** — 只用 Node 内置模块（`https`, `fs`, `path`, `os`, `crypto`）
- **scan-skills.js 不拆分** — CLAUDE.md 明确要求
- **Node >= 18** — 使用 `node:test`, `node:assert/strict`

### 新增的限制

- **在线目录依赖网络** — 离线时 `--recommend` 只输出本地分析（无在线推荐）
- **awesome-list 格式稳定性** — 解析逻辑依赖 Markdown 格式，如果 awesome-list 改格式需要更新解析器
- **缓存 TTL 1 小时** — 在线数据不是实时的

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| awesome-list 格式变化 | 推荐功能失效 | 解析器容错设计，失败时优雅降级 |
| GitHub API 限流 | 无法获取在线目录 | 使用 raw URL（无限流），缓存 1 小时 |
| 分类不准确 | 推荐质量差 | 复用 scan-skills 的 CATEGORY_MAP，持续优化 |
| HTML 文件过大 | 分享体验差 | 限制 skill 数量，分页加载 |

---

*设计完成于 2026-05-26*
