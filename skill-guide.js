#!/usr/bin/env node
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const SCANNER = path.join(ROOT, 'scan-skills.js');
const registryModule = require('./skill-registry');
const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function usage() {
  return [
    'Usage:',
    '  skill-guide                          # Dashboard: personality, radar, insights (opens HTML)',
    '  skill-guide --find <name|query>       # Deep dive or search (opens HTML)',
    '  skill-guide --doctor                  # Quick environment diagnostic',
    '  skill-guide --review --format json    # Structured review brief for agents',
    '  skill-guide --check [path]             # Check SKILL.md Review Readiness',
    '  skill-guide --overlap                  # Find overlapping skills by triggers/tools/tags',
    '',
    'Options:',
    '  --output <file>   Write to file instead of default',
    '  --format json     JSON output (no HTML)',
    '  --lang en|zh      UI language',
    '  --refresh         Force re-scan (ignore cache)',
    '  --all             Show skills from all platforms (default: current platform)',
    '  --platform <name> Force platform: claude | codex',
    '  --no-open         Do not open HTML in browser',
    '',
    'Examples:',
    '  npx skill-guide                        # See your dashboard',
    '  npx skill-guide --find investigate     # Deep dive into a skill',
    '  npx skill-guide --find security        # Search for security skills',
    '  npx skill-guide --doctor               # Check for issues',
    '  npx skill-guide --review --format json # Review brief for agents',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// i18n labels
// ---------------------------------------------------------------------------
const LABELS = {
  en: {
    yourAgentSkills: 'Your Agent Skills',
    yourClaudeSkills: 'Your Claude Code Skills',
    yourCodexSkills: 'Your Codex Skills',
    skillsScanned: 'skills scanned',
    noSources: 'No skill sources found',
    discovery: 'Discovery',
    toolSelection: 'Tool Selection',
    skillDeepDive: 'Skill Deep Dive',
    completeManual: 'Complete Manual',
    categoryMap: 'Category Map',
    highlights: 'Highlights',
    quickReference: 'Quick Reference',
    completeReference: 'Complete Reference',
    comparisonReference: 'Comparison Reference',
    whenToUse: 'When to Use',
    howItWorks: 'How It Works',
    limitations: 'Limitations',
    matchResults: 'Match Results',
    skillsCount: '{count} skills',
    noSkills: 'No skills found.',
    name: 'Name',
    category: 'Category',
    description: 'Description',
    triggers: 'Triggers',
    skillRecommendations: 'Skill Recommendations',
    yourSkillStack: 'Your skill stack',
    gapAnalysis: 'Gap Analysis',
    noSkillsInCategory: 'You have no {category} skills installed',
    tryThese: 'Try these',
    overlapAlert: 'Review Candidates',
    skillsInCategory: 'You have {count} skills in "{category}" category',
    considerKeeping: 'Review which ones you actually use',
    popularYoureMissing: 'Skills Mentioned in Directories',
    categoriesCovered: 'categories covered',
    myAiSkillStack: 'My AI Skill Stack',
    sharedBy: 'Shared by {user}',
    poweredBy: 'Powered by skill-guide',
    installSkillGuide: 'Install skill-guide to discover your skills',
    topPicks: 'Top Picks',
    nMore: '+ {count} more',
    ctaHeadline: 'Stop guessing. Start using.',
    ctaSubtext: 'Join developers who discovered skills they never knew they had',
    ctaGithub: 'Star on GitHub',
    strongest: 'Strongest',
    weakest: 'Weakest',
    cleanupOpportunities: 'Review Candidates',
    significantOverlap: 'same-category review candidates',
    mostDocumented: 'Most documented:',
    basedOnCompleteness: 'Based on documentation completeness',
    stackInsights: 'Stack Insights',
    capabilityMap: 'Capability Map',
    gapHint: '{action}',
    scatteredSkills: 'Scattered skills, no idea what you have?',
    manySkillsPain: '{count}+ skills but no idea what you have?',
    reviewBrief: 'Skill Review Brief',
    reviewItems: 'review items',
    reviewCopyPrompt: 'Copy Review Prompt',
    reviewPasteToAgent: 'Paste to your agent for semantic review',
    reviewNoItems: 'No review items found. Your skill stack looks clean!',
    reviewSecurity: 'Security Flags',
    reviewDuplicates: 'Duplicate Candidates',
    reviewOverlap: 'Category Overlap',
    reviewMalformed: 'Malformed Skills',
    reviewBudget: 'Budget Overflow',
  },
  zh: {
    yourAgentSkills: '你的 Agent Skills 技能库',
    yourClaudeSkills: '你的 Claude Code 技能库',
    yourCodexSkills: '你的 Codex 技能库',
    skillsScanned: '个技能已扫描',
    noSources: '未找到技能来源',
    discovery: '技能发现',
    toolSelection: '工具选择',
    skillDeepDive: '技能深入',
    completeManual: '完整技能手册',
    categoryMap: '分类概览',
    highlights: '精选推荐',
    quickReference: '快速参考',
    completeReference: '完整参考',
    comparisonReference: '对比参考',
    whenToUse: '何时使用',
    howItWorks: '运作原理',
    limitations: '使用限制',
    matchResults: '匹配结果',
    skillsCount: '{count} 个技能',
    noSkills: '未找到技能。',
    name: '名称',
    category: '分类',
    description: '描述',
    triggers: '触发词',
    skillRecommendations: '技能推荐',
    yourSkillStack: '你的技能栈',
    gapAnalysis: '空白分析',
    noSkillsInCategory: '你没有安装 {category} 类技能',
    tryThese: '试试这些',
    overlapAlert: '待复核候选',
    skillsInCategory: '你在 "{category}" 分类下有 {count} 个技能',
    considerKeeping: '请复核哪些技能确实常用',
    popularYoureMissing: '目录中提到的技能',
    categoriesCovered: '个分类已覆盖',
    myAiSkillStack: '我的 AI 技能栈',
    sharedBy: '由 {user} 分享',
    poweredBy: '由 skill-guide 驱动',
    installSkillGuide: '安装 skill-guide 来发现你的技能',
    topPicks: '精选推荐',
    nMore: '+ {count} 更多',
    ctaHeadline: '别再猜了，开始用吧',
    ctaSubtext: '加入已发现隐藏技能的开发者行列',
    ctaGithub: '在 GitHub 上 Star',
    strongest: '最强',
    weakest: '最弱',
    cleanupOpportunities: '待复核候选',
    significantOverlap: '同类技能候选',
    mostDocumented: '文档最完善:',
    basedOnCompleteness: '基于文档完整度',
    stackInsights: '技能栈洞察',
    capabilityMap: '能力图谱',
    gapHint: '{action}',
    scatteredSkills: '技能散落，不知道自己有什么？',
    manySkillsPain: '{count}+ 个技能但不知道自己有什么？',
    reviewBrief: '技能审查简报',
    reviewItems: '个审查项',
    reviewCopyPrompt: '复制审查提示词',
    reviewPasteToAgent: '粘贴给 Agent 进行语义审查',
    reviewNoItems: '没有发现需要审查的项目，技能栈看起来很干净！',
    reviewSecurity: '安全标记',
    reviewDuplicates: '重复候选',
    reviewOverlap: '类别重叠',
    reviewMalformed: '配置不完整',
    reviewBudget: '预算溢出',
  },
};

function lang() {
  const l = getArgValue('--lang');
  if (l === 'zh') return 'zh';
  return 'en';
}

function t(key) {
  return LABELS[lang()][key] || LABELS.en[key] || key;
}

// ---------------------------------------------------------------------------
// Content translation (EN -> ZH via phrase glossary)
// ---------------------------------------------------------------------------
const GLOSSARY_ZH = [
  ['comprehensive accessibility audit', '全面的无障碍审计'],
  ['structured design feedback', '结构化设计反馈'],
  ['systematic debugging workflow', '系统性调试工作流'],
  ['infrastructure-first security audit', '基础设施优先安全审计'],
  ['every important claim needs a source', '每个重要论点需要附带来源'],
  ['prefer recent data and call out stale data', '优先使用最新数据并标注过期数据'],
  ['include contrarian evidence and downside cases', '包含反面证据和下行情况'],
  ['translate findings into a decision', '将发现转化为决策建议'],
  ['not just a summary', '而非仅罗列事实'],
  ['all numbers are sourced or labeled as estimates', '所有数字有来源或标注为估算'],
  ['old data is flagged', '过期数据已标记'],
  ['the recommendation follows from the evidence', '建议基于证据得出'],
  ['risks and counterarguments are included', '包含风险和反面论据'],
  ['default structure', '默认结构'],
  ['executive summary', '执行摘要'],
  ['key findings', '核心发现'],
  ['risks and caveats', '风险与注意事项'],
  ['competitive analysis', '竞争分析'],
  ['market research', '市场调研'],
  ['market sizing', '市场规模估算'],
  ['investor research', '投资者研究'],
  ['due diligence', '尽职调查'],
  ['industry intelligence', '行业情报'],
  ['source attribution', '来源引用'],
  ['decision-oriented', '决策导向'],
  ['technology trend', '技术趋势'],
  ['investor dossier', '投资者档案'],
  ['portfolio company', '投资组合公司'],
  ['integration complexity', '集成复杂度'],
  ['adoption signals', '采纳信号'],
  ['code review', '代码审查'],
  ['code quality', '代码质量'],
  ['unit test', '单元测试'],
  ['regression test', '回归测试'],
  ['e2e testing', '端到端测试'],
  ['security audit', '安全审计'],
  ['slide presentation', '幻灯片演示'],
  ['code example', '代码示例'],
  ['design specification', '设计规范'],
  ['best practice', '最佳实践'],
  ['trade-off', '权衡取舍'],
  ['lock-in risk', '锁定风险'],
  ['red flag', '红旗警告'],
  ['check size', '投资规模'],
  ['fund size', '基金规模'],
  ['action recommendation', '行动建议'],
  ['fund research', '基金研究'],
  ['vendor research', '供应商调研'],
  ['technology scan', '技术扫描'],
  ['business decision', '商业决策'],
  ['product strategy', '产品策略'],
  ['user interface', '用户界面'],
  ['design system', '设计系统'],
  ['project overview', '项目概述'],
  ['use case', '使用场景'],
  ['skill content', '技能内容'],
  ['how it works', '运作原理'],
  ['when to use', '何时使用'],
  ['how to use', '使用方法'],
  ['use when', '当以下情况时使用'],
  ['use this', '使用此'],
  ['researching a market', '研究市场'],
  ['comparing competitors', '对比竞争对手'],
  ['preparing investor', '准备投资者'],
  ['building estimates', '构建估算'],
  ['quality gate', '质量把关'],
  ['before delivering', '交付前'],
  ['research standard', '调研标准'],
  ['output format', '输出格式'],
  ['common research mode', '常用调研模式'],
  ['public thesis', '公开投资理念'],
  ['recent activity', '近期动态'],
  ['obvious mismatch', '明显不匹配'],
  ['relevant portfolio', '相关投资组合'],
  ['security compliance', '安全合规'],
  ['operational risk', '运营风险'],
  ['visual hierarchy', '视觉层次'],
  ['color scheme', '色彩方案'],
  ['brand guideline', '品牌规范'],
  ['design principle', '设计原则'],
  ['test driven', '测试驱动'],
  ['continuous integration', '持续集成'],
  ['code coverage', '代码覆盖率'],
  ['dependency management', '依赖管理'],
  ['error handling', '错误处理'],
  ['performance optimization', '性能优化'],
  ['data validation', '数据验证'],
  ['API reference', 'API 参考'],
  ['quick reference', '快速参考'],
  ['step by step', '逐步'],
  ['front matter', '前置元数据'],
  ['security vulnerability', '安全漏洞'],
  ['threat model', '威胁建模'],
  ['supply chain', '供应链'],
  ['CI/CD pipeline', 'CI/CD 流水线'],
  ['landing page', '落地页'],
  ['admin panel', '管理后台'],
  ['slide deck', '幻灯片组'],
  ['conference talk', '会议演讲'],
  ['teaching material', '教学材料'],
  ['tech stack', '技术栈'],
  ['project structure', '项目结构'],
  ['file structure', '文件结构'],
  ['data flow', '数据流'],
  ['user flow', '用户流程'],
  ['state management', '状态管理'],
  ['route config', '路由配置'],
  ['database schema', '数据库结构'],
  ['data model', '数据模型'],
  ['SEO audit', 'SEO 审计'],
  ['presentation', '演示文稿'],
  ['dashboard', '仪表板'],
  ['screenshot', '截图'],
  ['checklist', '检查清单'],
  ['workflow', '工作流'],
  ['algorithm', '算法'],
  ['framework', '框架'],
  ['template', '模板'],
  ['component', '组件'],
  ['interface', '接口'],
  ['abstraction', '抽象'],
  ['refactoring', '重构'],
  ['debugging', '调试'],
  ['profiling', '性能分析'],
  ['benchmark', '基准测试'],
  ['deployment', '部署'],
  ['migration', '迁移'],
  ['automation', '自动化'],
  ['orchestration', '编排'],
  ['scalability', '可扩展性'],
  ['reliability', '可靠性'],
  ['monitoring', '监控'],
  ['observability', '可观测性'],
  ['resilience', '韧性'],
  ['encryption', '加密'],
  ['authentication', '认证'],
  ['authorization', '授权'],
  ['compliance', '合规'],
  ['governance', '治理'],
  ['vulnerability', '漏洞'],
  ['architecture', '架构'],
  ['infrastructure', '基础设施'],
  ['microservice', '微服务'],
  ['serverless', '无服务器'],
  ['containerization', '容器化'],
  ['concurrency', '并发'],
  ['asynchronous', '异步'],
  ['synchronous', '同步'],
  ['idiomatic', '惯用'],
  ['boilerplate', '样板代码'],
  ['implement', '实现'],
  ['integrate', '集成'],
  ['configure', '配置'],
  ['troubleshoot', '排查'],
  ['diagnose', '诊断'],
  ['repository', '仓库'],
  ['endpoint', '端点'],
  ['middleware', '中间件'],
  ['dependency', '依赖'],
  ['plugin', '插件'],
  ['extension', '扩展'],
  ['webhook', 'Webhook'],
  ['payload', '负载'],
  ['schema', '模式'],
  ['fixture', '测试夹具'],
  ['snapshot', '快照'],
  ['mock', '模拟'],
  ['keyword', '关键词'],
  ['security', '安全'],
  ['performance', '性能'],
  ['testing', '测试'],
  ['documentation', '文档'],
  ['development', '开发'],
  ['quality', '质量'],
  ['collection', '收集'],
  ['recommendation', '建议'],
  ['implications', '影响'],
  ['summary', '摘要'],
  ['overview', '概述'],
  ['examples', '示例'],
  ['sources', '来源'],
  ['middleware', '中间件'],
];

let _compiledGlossary = null;
function getCompiledGlossary() {
  if (_compiledGlossary) return _compiledGlossary;
  _compiledGlossary = GLOSSARY_ZH.map(([en, zh]) => ({
    re: new RegExp('\\b' + en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'),
    zh,
  }));
  return _compiledGlossary;
}

function translateContent(text) {
  if (lang() !== 'zh' || !text) return text;
  let result = text;
  for (const { re, zh } of getCompiledGlossary()) {
    result = result.replace(re, zh);
  }
  return result;
}

function te(text) {
  return escapeHtml(translateContent(text));
}

function parseMode() {
  if (hasFlag('--help') || hasFlag('-h')) return { mode: 'help' };
  if (hasFlag('--doctor')) return { mode: 'doctor' };
  if (hasFlag('--review')) return { mode: 'review' };
  if (hasFlag('--recommend')) return { mode: 'recommend' };
  if (hasFlag('--share')) return { mode: 'share' };
  if (hasFlag('--check')) {
    const checkVal = getArgValue('--check');
    if (checkVal && !checkVal.startsWith('-')) return { mode: 'check', value: checkVal };
    return { mode: 'check' };
  }
  // Legacy alias
  if (hasFlag('--lint')) {
    const lintVal = getArgValue('--lint');
    if (lintVal && !lintVal.startsWith('-')) return { mode: 'check', value: lintVal };
    return { mode: 'check' };
  }

  if (hasFlag('--overlap')) return { mode: 'overlap' };

  // --find: unified search + deep dive (also supports legacy --search, --skill)
  const find = getArgValue('--find') || getArgValue('--search') || getArgValue('--skill');
  if (find) return { mode: 'find', value: find };

  // Positional arg: treat as --find
  const valueFlags = new Set(['--output', '--find', '--search', '--skill', '--format', '--lang', '--user', '--platform', '--check', '--lint']);
  const positional = args.find((arg, index) => !arg.startsWith('-') && !valueFlags.has(args[index - 1]));
  if (positional) return { mode: 'find', value: positional };

  return { mode: 'list' };
}

function scannerArgsFor(mode) {
  const scannerArgs = [];
  if (hasFlag('--refresh')) scannerArgs.push('--refresh');

  if (mode.mode === 'list' || mode.mode === 'doctor') {
    scannerArgs.push('--list');
  } else if (mode.mode === 'review') {
    scannerArgs.push('--full');
  } else if (mode.mode === 'find') {
    // Try as skill first, fall back to search
    scannerArgs.push('--skill', mode.value);
  } else if (mode.mode === 'check') {
    if (!mode.value) scannerArgs.push('--full'); // check all: need full data
  } else if (mode.mode === 'overlap') {
    scannerArgs.push('--full');
  } else {
    scannerArgs.push('--full');
  }

  return scannerArgs;
}

function runScanner(mode) {
  const args = scannerArgsFor(mode);
  const needsFullBuffer = mode.mode !== 'list' && mode.mode !== 'doctor';
  if (needsFullBuffer) {
    const result = spawnSync(process.execPath, [SCANNER, ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    });
    if (result.status !== 0) {
      process.stderr.write(result.stderr || '');
      process.exit(result.status || 1);
    }
    return JSON.parse(result.stdout);
  }
  const output = execFileSync(process.execPath, [SCANNER, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function defaultOutputPath(mode) {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = mode.mode === 'search' ? 'selection' : mode.mode === 'skill' ? mode.value : mode.mode;
  const safeSuffix = String(suffix).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return path.join(process.cwd(), `skill-guide-${safeSuffix || 'list'}-${date}.html`);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value, length) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function renderMd(text) {
  if (!text) return '';
  let html = escapeHtml(translateContent(text));
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
  html = html.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');
  return html;
}

function titleForSources(sources) {
  const labels = Object.keys(sources || {}).filter((key) => sources[key] > 0);
  const hasClaude = labels.some((label) => label.startsWith('claude'));
  const hasCodex = labels.some((label) => label.startsWith('codex'));
  if (hasClaude && hasCodex) return t('yourAgentSkills');
  if (hasCodex) return t('yourCodexSkills');
  if (hasClaude) return t('yourClaudeSkills');
  return t('yourAgentSkills');
}

function sourceSummary(sources) {
  const isZh = lang() === 'zh';
  const labels = isZh ? {
    'claude-user': 'Claude',
    'codex-user': 'Codex',
    'openai-system': 'OpenAI 系统',
    'cc-switch': 'cc-switch',
    'claude-plugin': 'Claude 插件',
    'codex-plugin': 'Codex 插件',
  } : {
    'claude-user': 'Claude',
    'codex-user': 'Codex',
    'openai-system': 'OpenAI system',
    'cc-switch': 'cc-switch',
    'claude-plugin': 'Claude plugins',
    'codex-plugin': 'Codex plugins',
  };
  return Object.entries(sources || {})
    .filter(([, count]) => count > 0)
    .map(([source, count]) => `${count} ${labels[source] || source}`)
    .join(' · ');
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'other';
    if (!acc[value]) acc[value] = [];
    acc[value].push(item);
    return acc;
  }, {});
}

function categoryBadge(category) {
  return `<span class="badge badge-${escapeHtml(category)}">${escapeHtml(category)}</span>`;
}

function sourceBadges(sources) {
  return (sources || []).map((source) => `<span class="source">${escapeHtml(source)}</span>`).join('');
}

function renderCover(data, mode) {
  const title = titleForSources(data.sources);
  const subtitle = sourceSummary(data.sources) || t('noSources');
  const modeLabel = {
    list: t('discovery'),
    search: t('toolSelection'),
    skill: t('skillDeepDive'),
    full: t('completeManual'),
  }[mode.mode] || t('discovery');

  // Add personality for default mode
  const skills = data.skills || [];
  let personalityLine = '';
  if (mode.mode === 'list' && skills.length > 0) {
    const personality = analyzeSkillPersonality(skills);
    personalityLine = `<p class="sub" style="font-size:1.3rem;color:var(--accent);font-weight:600;margin-top:8px">${personality.emoji} ${escapeHtml(personality.type)} · ${lang() === 'zh' ? '本地画像' : 'local profile'}</p>`;
  }

  return `<section class="slide cover">
    <div class="rv center">
      <div class="kicker" data-i18n="label">${escapeHtml(modeLabel)}</div>
      <h1><span class="grad" data-i18n="label">${escapeHtml(title)}</span></h1>
      <p class="sub">${escapeHtml(data.totalCount || 0)} ${t('skillsScanned')} · ${escapeHtml(subtitle)}</p>
      ${personalityLine}
      <div class="stats">${Object.entries(data.sources || {}).map(([source, count]) => `<div class="stat"><b>${count}</b><span data-i18n="label">${escapeHtml(source)}</span></div>`).join('')}</div>
    </div>
  </section>`;
}

function renderCategorySlide(skills) {
  const groups = groupBy(skills, 'category');
  const cards = Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, items]) => `<article class="card">
      <h3>${escapeHtml(category)}</h3>
      <p>${t('skillsCount').replace('{count}', items.length)}</p>
      <div class="chips">${items.slice(0, 8).map((skill) => `<span>${escapeHtml(skill.name)}</span>`).join('')}</div>
    </article>`).join('');

  return `<section class="slide">
    <div class="rv wide">
      <h2 data-i18n="label">${t('categoryMap')}</h2>
      <div class="grid">${cards || `<p class="empty">${t('noSkills')}</p>`}</div>
    </div>
  </section>`;
}

function renderHighlights(skills) {
  const isZh = lang() === 'zh';

  // Score skills by configuration quality (readiness)
  function readinessScore(s) {
    let score = 0;
    if ((s.description || '').length > 100) score += 20;
    if ((s.description || '').length > 200) score += 10;
    if ((s.allowedTools || []).length > 0) score += 30;
    if ((s.triggers || []).length > 0) score += 20;
    if ((s.tokenCost || 0) > 50) score += 10;
    if ((s.sources || []).length > 1) score += 10;
    return score;
  }

  // Pick the best skill from each major category
  const groups = groupBy(skills, 'category');
  const topPicks = Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([category, items]) => {
      const best = [...items].sort((a, b) => readinessScore(b) - readinessScore(a))[0];
      return { ...best, _pickCategory: category };
    });

  return `<section class="slide">
    <div class="rv wide">
      <h2 data-i18n="label">${isZh ? '每类最佳' : 'Best in Category'}</h2>
      <p class="sub" style="margin-bottom:24px">${isZh
        ? '从每个领域中选出配置最完整的技能'
        : 'The best-configured skill from each category'}</p>
      <div class="list">${topPicks.map((skill, index) => `<article class="row">
        <strong>${index + 1}</strong>
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <p data-i18n="desc">${te(truncate(skill.description, 180))}</p>
          <div>${categoryBadge(skill._pickCategory)}${(skill.triggers || []).length > 0 ? `<span class="badge" style="background:rgba(34,197,94,.08);color:var(--accent2);border:1px solid rgba(34,197,94,.15)">${skill.triggers.length} triggers</span>` : ''}${(skill.sources || []).length > 1 ? `<span class="badge" style="background:rgba(129,140,248,.08);color:var(--ab);border:1px solid rgba(129,140,248,.15)">${skill.sources.length} platforms</span>` : ''}</div>
        </div>
      </article>`).join('')}</div>
    </div>
  </section>`;
}

function renderReference(skills, title) {
  const refTitle = title || t('quickReference');
  const rows = skills.map((skill) => `<tr>
    <td>${escapeHtml(skill.name)}</td>
    <td>${categoryBadge(skill.category)}</td>
    <td data-i18n="desc">${te(truncate(skill.description, 160))}</td>
    <td>${escapeHtml((skill.triggers || []).slice(0, 4).join(', '))}</td>
  </tr>`).join('');

  return `<section class="slide">
    <div class="rv wide">
      <h2 data-i18n="label">${escapeHtml(refTitle)}</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>${t('name')}</th><th>${t('category')}</th><th>${t('description')}</th><th>${t('triggers')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
  </section>`;
}

function renderSkillDetails(skills) {
  return skills.map((skill) => `<section class="slide">
    <div class="rv wide detail">
      <h2>${escapeHtml(skill.name)}</h2>
      <div class="sub-md" data-i18n="desc">${renderMd(skill.description)}</div>
      <div class="meta">${categoryBadge(skill.category)}${sourceBadges(skill.sources)}${(skill.allowedTools || []).map((tool) => `<code>${escapeHtml(tool)}</code>`).join('')}</div>
      ${skill.whenToUse ? `<h3 data-i18n="label">${t('whenToUse')}</h3><div class="md-content" data-i18n="when-to-use">${renderMd(skill.whenToUse)}</div>` : ''}
      ${skill.howItWorks ? `<h3 data-i18n="label">${t('howItWorks')}</h3><div class="md-content" data-i18n="how-it-works">${renderMd(skill.howItWorks)}</div>` : ''}
      ${skill.limitations ? `<h3 data-i18n="label">${t('limitations')}</h3><div class="md-content" data-i18n="limitations">${renderMd(skill.limitations)}</div>` : ''}
      ${(skill.sections || []).length ? `<div class="steps">${skill.sections.slice(0, 8).map((section, index) => `<article><b>${index + 1}</b><span data-i18n="section-title">${te(section.title)}</span><div class="md-content" data-i18n="section-body">${renderMd(section.summary)}</div></article>`).join('')}</div>` : ''}
    </div>
  </section>`).join('');
}

function renderSelection(data, mode) {
  return `<section class="slide">
    <div class="rv wide">
      <h2 data-i18n="label">${t('matchResults')}</h2>
      <p class="quote">${escapeHtml(mode.value || '')}</p>
      <div class="list">${data.skills.slice(0, 12).map((skill, index) => `<article class="row">
        <strong>${index + 1}</strong>
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <p data-i18n="desc">${te(truncate(skill.description, 220))}</p>
          <div>${categoryBadge(skill.category)}${sourceBadges(skill.sources)}</div>
        </div>
      </article>`).join('')}</div>
    </div>
  </section>${renderReference(data.skills.slice(0, 20), t('comparisonReference'))}`;
}


function renderInsightDashboardSlide(skills) {
  const isZh = lang() === 'zh';
  const health = computeHealthStats(skills);
  const personality = analyzeSkillPersonality(skills);
  const radar = computeRadarScores(skills, health);
  const wrapped = computeWrappedStats(skills, health);
  const totalTokens = skills.reduce((sum, s) => sum + (s.tokenCost || 0), 0);
  const tokenK = (totalTokens / 1000).toFixed(1);
  const pct = Math.round((totalTokens / 200000) * 100 * 100) / 100;

  return `<section class="slide">
    <div class="rv center">
      <div class="kicker" data-i18n="label">${isZh ? '你的技能画像' : 'YOUR SKILL PROFILE'}</div>
      <h2>${personality.emoji} ${escapeHtml(personality.type)}</h2>
      <p class="sub">${escapeHtml(personality.description)}</p>
      <div class="stats" style="margin:24px 0">
        <div class="stat"><b>${skills.length}</b><span>${isZh ? '技能' : 'skills'}</span></div>
        <div class="stat"><b>${radar.overall}/100</b><span>${isZh ? '健康度' : 'health'}</span></div>
        <div class="stat"><b>${Object.keys(groupBy(skills, 'category')).length}/9</b><span>${isZh ? '领域' : 'categories'}</span></div>
        <div class="stat"><b>~${tokenK}K</b><span>tokens</span></div>
      </div>
      ${renderDimensionRadar(radar.dimensions)}
      <p class="sub" style="margin-top:16px;font-size:14px;color:var(--muted)">${isZh
        ? `🔤 描述 Token 估算：约为 200K 参考 context 的 ${pct}%`
        : `🔤 Estimated description tokens: ${pct}% of a 200K reference context`}</p>
    </div>
  </section>`;
}

function renderCleanupSlide(skills) {
  const isZh = lang() === 'zh';

  // Build review brief for evidence-based candidates
  const data = { skills };
  const details = doctorDetails(data);
  const brief = buildReviewBrief(data, details);
  const copyPrompt = buildCopyPrompt(brief);
  const promptId = `rp-${crypto.randomUUID().slice(0, 8)}`;

  // Source breakdown
  const userSkills = skills.filter(s => (s.sources || []).some(src => ['claude-user', 'codex-user', 'cc-switch'].includes(src)));
  const pluginSkills = skills.filter(s => (s.sources || []).some(src => ['claude-plugin', 'codex-plugin'].includes(src)));
  const systemSkills = skills.filter(s => (s.sources || []).includes('openai-system'));

  const userPct = skills.length > 0 ? Math.round((userSkills.length / skills.length) * 100) : 0;
  const pluginPct = skills.length > 0 ? Math.round((pluginSkills.length / skills.length) * 100) : 0;

  const hasReviewItems = brief.totalReviewItems > 0;
  const severityColor = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280', info: '#818cf8' };
  const typeIcon = { security: '🔴', duplicate: '🟡', malformed: '⚪', overlap: '🟣', budget: '🔵' };
  const typeLabel = {
    security: isZh ? '安全标记' : 'Security flags',
    duplicate: isZh ? '重复候选' : 'Duplicate candidates',
    malformed: isZh ? '配置不完整' : 'Malformed',
    overlap: isZh ? '语义重叠' : 'Semantic overlap',
    budget: isZh ? '预算溢出' : 'Budget overflow',
  };

  // Build review cards by type
  const typeOrder = ['security', 'duplicate', 'malformed', 'overlap', 'budget'];
  let reviewCards = '';
  for (const type of typeOrder) {
    const typeItems = brief.items.filter(i => i.type === type || (type === 'overlap' && i.type === 'semantic-overlap'));
    if (typeItems.length === 0) continue;
    const itemsHtml = typeItems.slice(0, 3).map(item => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:11px;font-weight:700;color:${severityColor[item.severity]};background:${severityColor[item.severity]}22;padding:2px 6px;border-radius:4px">${item.severity.toUpperCase()}</span>
          <span style="font-size:13px;font-weight:600">${item.skills.map(s => escapeHtml(s)).join(', ')}</span>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:0">${escapeHtml(truncate(item.evidence, 80))}</p>
      </div>`).join('');
    const moreCount = typeItems.length - 3;
    reviewCards += `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:12px 16px;max-width:580px;margin:0 auto 10px;text-align:left">
      <p style="margin:0 0 6px;font-weight:600;font-size:13px">${typeIcon[type]} ${typeLabel[type]} (${typeItems.length})</p>
      ${itemsHtml}
      ${moreCount > 0 ? `<p style="font-size:11px;color:var(--muted);margin:4px 0 0">+ ${moreCount} more</p>` : ''}
    </div>`;
  }

  return `<section class="slide">
    <div class="rv center">
      <div class="kicker" data-i18n="label">${isZh ? '复核候选' : 'REVIEW CANDIDATES'}</div>
      <h2>${isZh ? '你的技能从哪来的？' : 'Where did your skills come from?'}</h2>
      <div class="stats" style="margin:20px 0">
        <div class="stat" style="border-color:var(--accent)"><b>${userSkills.length}</b><span>${isZh ? '用户目录来源' : 'user-directory sources'}</span></div>
        <div class="stat"><b>${pluginSkills.length}</b><span>${isZh ? '插件目录来源' : 'plugin-directory sources'}</span></div>
        <div class="stat"><b>${systemSkills.length}</b><span>${isZh ? '系统目录来源' : 'system-directory sources'}</span></div>
      </div>
      <div style="background:var(--bg);border-radius:8px;height:12px;max-width:400px;margin:0 auto 20px;overflow:hidden;display:flex">
        <div style="background:var(--accent);height:100%;width:${userPct}%" title="${isZh ? '用户目录来源' : 'User-directory sources'}"></div>
        <div style="background:var(--ab);height:100%;width:${pluginPct}%" title="${isZh ? '插件目录来源' : 'Plugin-directory sources'}"></div>
      </div>

      ${hasReviewItems ? `
        <div style="max-width:580px;margin:0 auto">
          <p style="font-size:13px;color:var(--muted);margin:0 0 12px">${isZh
            ? `${brief.totalReviewItems} 个候选需要复核 — 点击下方按钮生成审查提示词，粘贴给你的 Agent 进行语义判断`
            : `${brief.totalReviewItems} candidates to review — click below to generate a review prompt, paste it to your agent for semantic judgment`}</p>
          ${reviewCards}
          <div style="text-align:center;margin-top:12px">
            <button onclick="copyText(window['${promptId}'])" style="background:var(--accent);color:#0F172A;border:none;border-radius:var(--r);padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer">${isZh ? '📋 复制审查提示词' : '📋 Copy Review Prompt'}</button>
            <p style="font-size:11px;color:var(--muted);margin:8px 0 0;font-style:italic">${isZh
              ? 'Agent 会对每项回复 CONFIRM / DISMISS / SUGGEST，确认前不要删除任何东西'
              : 'Agent responds CONFIRM / DISMISS / SUGGEST per item; do not delete anything until you confirm'}</p>
          </div>
          <script>window['${promptId}']=${JSON.stringify(copyPrompt)};</script>
        </div>
      ` : `<p style="font-size:14px;color:var(--accent)">${isZh ? '没有发现需要复核的候选，技能栈看起来很干净！' : 'No review candidates found. Your skill stack looks clean!'}</p>`}
    </div>
  </section>`;
}

function renderNextStepsSlide(skills) {
  const isZh = lang() === 'zh';
  const sample = (skills || []).filter(s => (s.description || '').length > 100).slice(0, 3);
  const sampleName = sample.length > 0 ? sample[0].name : 'investigate';
  const sampleName2 = sample.length > 1 ? sample[1].name : 'security-audit';
  const searchCmd = `npx skill-guide security`;
  const skillCmd = `npx skill-guide ${sampleName}`;
  const fullCmd = `npx skill-guide --full`;
  const recommendCmd = `npx skill-guide --recommend`;
  const shareCmd = `npx skill-guide --share`;
  const doctorCmd = `npx skill-guide --doctor`;

  return `<section class="slide">
    <div class="rv center">
      <div class="kicker" data-i18n="label">${isZh ? '下一步' : 'GO DEEPER'}</div>
      <h2 data-i18n="label">${isZh ? '试试这些命令' : 'Try these commands'}</h2>
      <p class="sub" style="font-size:14px">${isZh ? '点击命令即可复制' : 'Click any command to copy'}</p>
      <div style="max-width:640px;margin:24px auto 0;text-align:left">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px">
          <p style="margin:0 0 6px;color:var(--accent);font-weight:600;font-size:14px">${isZh ? '🔍 搜索技能' : '🔍 Search for a skill'}</p>
          <code style="display:block;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:13px;color:var(--accent2);cursor:pointer" onclick="copyText('${searchCmd}')">${searchCmd}</code>
          <p style="margin:6px 0 0;font-size:12px;color:var(--muted)">${isZh ? '试试替换关键词: debug, deploy, design, test...' : 'Replace the keyword: try debug, deploy, design, test...'}</p>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px">
          <p style="margin:0 0 6px;color:var(--accent);font-weight:600;font-size:14px">${isZh ? '📖 深入了解一个技能' : '📖 Deep dive into a skill'}</p>
          <code style="display:block;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:13px;color:var(--accent2);cursor:pointer" onclick="copyText('${skillCmd}')">${skillCmd}</code>
          <p style="margin:6px 0 0;font-size:12px;color:var(--muted)">${isZh ? `查看 ${sampleName} 的触发词、使用场景和限制` : `See ${sampleName}\'s triggers, use cases, and limitations`}</p>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px">
          <p style="margin:0 0 6px;color:var(--accent);font-weight:600;font-size:14px">${isZh ? '📊 完整参考手册' : '📊 Full reference'}</p>
          <code style="display:block;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:13px;color:var(--accent2);cursor:pointer" onclick="copyText('${fullCmd}')">${fullCmd}</code>
          <p style="margin:6px 0 0;font-size:12px;color:var(--muted)">${isZh ? '一页一个技能，完整的使用手册' : 'One page per skill, complete manual'}</p>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px">
          <p style="margin:0 0 6px;color:var(--accent);font-weight:600;font-size:14px">${isZh ? '🌐 在线推荐' : '🌐 Get recommendations'}</p>
          <code style="display:block;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:13px;color:var(--accent2);cursor:pointer" onclick="copyText('${recommendCmd}')">${recommendCmd}</code>
          <p style="margin:6px 0 0;font-size:12px;color:var(--muted)">${isZh ? '查看目录提及项，并复核同类技能候选' : 'Review directory mentions and same-category candidates'}</p>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px">
          <p style="margin:0 0 6px;color:var(--accent);font-weight:600;font-size:14px">${isZh ? '📤 分享你的技能栈' : '📤 Share your skill stack'}</p>
          <code style="display:block;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:13px;color:var(--accent2);cursor:pointer" onclick="copyText('${shareCmd}')">${shareCmd}</code>
          <p style="margin:6px 0 0;font-size:12px;color:var(--muted)">${isZh ? '生成一个可分享的技能组合页面' : 'Generate a shareable portfolio page of your skills'}</p>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px">
          <p style="margin:0 0 6px;color:var(--accent);font-weight:600;font-size:14px">${isZh ? '🩺 诊断环境' : '🩺 Diagnose environment'}</p>
          <code style="display:block;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:13px;color:var(--accent2);cursor:pointer" onclick="copyText('${doctorCmd}')">${doctorCmd}</code>
          <p style="margin:6px 0 0;font-size:12px;color:var(--muted)">${isZh ? '检查损坏文件、重复技能、路径问题' : 'Check broken files, duplicates, path issues'}</p>
        </div>
      </div>
    </div>
  </section>`;
}

function renderSlides(data, mode) {
  if (data.error) {
    return `${renderCover(data, mode)}<section class="slide"><div class="rv center"><h2>Error</h2><p class="sub">${escapeHtml(data.error)}</p></div></section>`;
  }

  if (mode.mode === 'search') return `${renderCover(data, mode)}${renderSelection(data, mode)}`;
  if (mode.mode === 'skill') return `${renderCover(data, mode)}${renderSkillDetails(data.skills)}`;
  if (mode.mode === 'full') return `${renderCover(data, mode)}${renderCategorySlide(data.skills)}${renderSkillDetails(data.skills)}${renderReference(data.skills, t('completeReference'))}`;
  return `${renderCover(data, mode)}${renderInsightDashboardSlide(data.skills)}${renderCleanupSlide(data.skills)}${renderCategorySlide(data.skills)}${renderHighlights(data.skills)}${renderReference(data.skills)}${renderNextStepsSlide(data.skills)}`;
}

function renderHtml(data, mode) {
  const slides = renderSlides(data, mode);
  const htmlLang = lang();
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titleForSources(data.sources))} - skill-guide</title>
<style>
:root{--bg:#0F172A;--bg2:#1E293B;--card:#1E293B;--card-h:#273347;--t:#F8FAFC;--muted:#94A3B8;--accent:#22C55E;--accent2:#34D399;--ab:#818cf8;--ap:#c084fc;--am:#6ee7b7;--r:12px;--border:#334155;--shadow:0 4px 24px rgba(0,0,0,.35);--mono:"SF Mono","Fira Code","Cascadia Code",monospace}
*{box-sizing:border-box}html{scroll-snap-type:y mandatory;scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--t);font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
a.skip{position:absolute;top:-100%;left:16px;background:var(--accent);color:#0F172A;padding:8px 16px;border-radius:var(--r);z-index:999;font-weight:600;text-decoration:none}a.skip:focus{top:8px}
.slide{min-height:100vh;min-height:100dvh;scroll-snap-align:start;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:clamp(24px,5vw,64px)}.slide::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 20% 50%,rgba(34,197,94,.04),transparent 60%),radial-gradient(ellipse at 80% 80%,rgba(129,140,248,.04),transparent 50%);pointer-events:none}
.center,.wide{position:relative;z-index:1}.center{text-align:center;max-width:960px}.wide{width:min(1120px,100%)}
h1{font-size:clamp(36px,6vw,72px);line-height:1.05;margin:0 0 16px;font-weight:800;letter-spacing:-.02em;color:var(--t)}h1 .grad{background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;color:transparent}
h2{font-size:clamp(24px,3.5vw,44px);line-height:1.1;margin:0 0 24px;text-align:center;letter-spacing:-.01em;color:var(--t)}h3{margin:0 0 6px;font-size:16px;font-weight:600}
.sub{font-size:clamp(15px,1.8vw,20px);line-height:1.6;color:var(--muted);margin:0 auto 24px;max-width:860px}
.kicker{text-transform:uppercase;letter-spacing:.16em;color:var(--accent);font-size:11px;font-weight:700;margin-bottom:16px;font-family:var(--mono)}
.stats{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px}.stat{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:12px 20px;min-width:120px;transition:border-color .2s}.stat:hover{border-color:var(--accent)}.stat b{display:block;font-size:26px;color:var(--t)}.stat span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-family:var(--mono)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.card,.row{background:var(--card);border:1px solid var(--border);border-radius:var(--r);transition:border-color .2s,transform .15s;cursor:default}.card:hover,.row:hover{border-color:var(--accent);transform:translateY(-1px)}
.card{padding:18px}.card p,.row p,.detail p{color:var(--muted);line-height:1.55;font-size:14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;overflow:hidden;max-height:72px}.chips span,.badge,.source{display:inline-flex;align-items:center;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:600}.chips span{background:var(--bg);color:var(--muted);border:1px solid var(--border)}.badge{background:rgba(34,197,94,.12);color:var(--accent2);border:1px solid rgba(34,197,94,.2);margin-right:4px}.source{background:rgba(129,140,248,.1);color:var(--ab);border:1px solid rgba(129,140,248,.18);margin-right:4px}
.list{display:flex;flex-direction:column;gap:10px}.row{display:grid;grid-template-columns:44px 1fr;gap:12px;padding:16px}.row strong{font-size:24px;color:var(--accent);line-height:1;font-family:var(--mono);font-weight:700}
.table-wrap{max-height:72vh;overflow:auto;border-radius:var(--r);border:1px solid var(--border);background:var(--card)}table{border-collapse:collapse;width:100%;font-size:13px}th{position:sticky;top:0;background:var(--bg2);color:var(--accent);text-align:left;font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.06em}th,td{padding:10px 14px;border-bottom:1px solid var(--border)}tr:hover td{background:rgba(34,197,94,.04)}
.meta{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:14px 0 22px}.meta code{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:var(--mono);font-size:12px;color:var(--muted)}
.detail{text-align:center}.detail h3{margin-top:20px;color:var(--accent);font-family:var(--mono);font-size:13px;text-transform:uppercase;letter-spacing:.1em}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:18px;text-align:left}.steps article{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px;transition:border-color .2s}.steps article:hover{border-color:var(--accent)}.steps b{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:6px;background:var(--accent);color:#0F172A;margin-right:8px;font-size:13px;font-weight:700}.steps span{font-weight:600;color:var(--t)}.steps p{font-size:13px;margin-top:4px}
.quote{font-size:18px;color:var(--muted);text-align:center;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;font-family:var(--mono)}.empty{text-align:center;color:var(--muted)}
.md-content{color:var(--muted);line-height:1.6;font-size:14px;text-align:left}.md-content strong{color:var(--t);font-weight:600}.md-content code{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-family:var(--mono);font-size:12px;color:var(--accent2)}.md-content blockquote{border-left:3px solid var(--accent);margin:8px 0;padding:6px 12px;color:var(--muted);font-style:italic}.md-content ul{margin:6px 0;padding-left:20px}.md-content li{margin:3px 0}.sub-md{color:var(--muted);line-height:1.6;font-size:clamp(15px,1.8vw,20px);margin:0 auto 24px;max-width:860px;text-align:center}.sub-md strong{color:var(--t);font-weight:600}.sub-md code{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-family:var(--mono);font-size:12px;color:var(--accent2)}
.rv{opacity:0;transform:translateY(18px);transition:opacity .4s ease,transform .4s ease}.rv.v{opacity:1;transform:none}
nav.progress{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:10;padding:6px 12px;background:var(--card);border:1px solid var(--border);border-radius:999px}nav.progress button{width:8px;height:8px;border-radius:50%;border:none;background:var(--border);cursor:pointer;padding:0;transition:background .2s,transform .15s}nav.progress button.active{background:var(--accent);transform:scale(1.3)}nav.progress button:hover{background:var(--muted)}nav.progress button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.shortcut{position:fixed;bottom:16px;right:16px;font-family:var(--mono);font-size:10px;color:var(--muted);background:var(--card);border:1px solid var(--border);border-radius:6px;padding:4px 8px;z-index:10;opacity:.5}
@media(prefers-reduced-motion:reduce){.rv{opacity:1;transform:none;transition:none}.card:hover,.row:hover,.steps article:hover{transform:none}}
@media(max-width:760px){.slide{padding:20px 14px}.row{grid-template-columns:1fr}.row strong{font-size:18px}.table-wrap{max-height:60vh}nav.progress{bottom:10px}nav.progress button{width:10px;height:10px}.shortcut{display:none}.stats{gap:8px}.stat{min-width:90px;padding:10px 14px}.stat b{font-size:22px}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<a class="skip" href="#main">${lang() === 'zh' ? '跳到主要内容' : 'Skip to content'}</a>
<main id="main">
${slides}
</main>
<nav class="progress" aria-label="${lang() === 'zh' ? '幻灯片导航' : 'Slide navigation'}"></nav>
<div class="shortcut" aria-hidden="true">↓ ↑ Space</div>
<script>
function copyText(t){var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');var b=event&&event.target?event.target.closest('code,button'):null;if(b){var o=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=o},1200)}}catch(e){}document.body.removeChild(ta)}
const seen=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('v')}),{threshold:.12});
document.querySelectorAll('.rv').forEach(el=>seen.observe(el));
const slides=[...document.querySelectorAll('.slide')];
const nav=document.querySelector('nav.progress');
slides.forEach((_,i)=>{const b=document.createElement('button');b.setAttribute('aria-label','${htmlLang==='zh'?'幻灯片':'Slide'} '+(i+1));b.addEventListener('click',()=>slides[i]?.scrollIntoView());nav.appendChild(b)});
function updateNav(){const i=slides.findIndex(s=>{const r=s.getBoundingClientRect();return r.top>-10&&r.top<innerHeight/2});nav.querySelectorAll('button').forEach((b,j)=>b.classList.toggle('active',j===i))}
document.addEventListener('scroll',updateNav,{passive:true});updateNav();
document.addEventListener('keydown',e=>{const i=slides.findIndex(s=>{const r=s.getBoundingClientRect();return r.top>-10&&r.top<innerHeight/2});if(['ArrowDown','ArrowRight',' '].includes(e.key)){e.preventDefault();slides[Math.min(i+1,slides.length-1)]?.scrollIntoView()}if(['ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();slides[Math.max(i-1,0)]?.scrollIntoView()}});
</script>
</body>
</html>
`;
}

function openFile(file) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const argsForOpen = process.platform === 'win32' ? ['/c', 'start', '', file] : [file];
  spawnSync(command, argsForOpen, { stdio: 'ignore', detached: true });
}

function shouldAutoOpen() {
  if (hasFlag('--no-open')) return false;
  if (hasFlag('--open')) return true;
  const format = getArgValue('--format');
  if (format === 'json') return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

const PLATFORM_LABELS = { claude: 'Claude Code', codex: 'Codex', all: 'All Platforms' };

function detectPlatform() {
  if (hasFlag('--all')) return 'all';
  const explicit = getArgValue('--platform');
  if (explicit && PLATFORM_LABELS[explicit]) return explicit;
  if (process.env.CODEX_AGENT) return 'codex';
  if (process.env.CLAUDE_CODE) return 'claude';
  const dir = __dirname;
  if (dir.includes(path.join('.claude', 'skills')) || dir.includes(path.join('.claude', 'plugins'))) return 'claude';
  if (dir.includes(path.join('.codex', 'skills')) || dir.includes(path.join('.codex', 'plugins'))) return 'codex';
  return 'all';
}

function filterSkillsByPlatform(skills, platform) {
  if (platform === 'all') return skills;
  if (platform === 'codex') {
    return skills.filter(s => (s.sources || []).some(src => 
      ['codex-user', 'codex-plugin', 'openai-system', 'cc-switch'].includes(src)));
  }
  if (platform === 'claude') {
    return skills.filter(s => (s.sources || []).some(src => 
      ['claude-user', 'claude-plugin', 'cc-switch'].includes(src)));
  }
  return skills;
}

function applyPlatformFilter(data) {
  const platform = detectPlatform();
  if (platform === 'all') {
    data._platform = 'all';
    return data;
  }
  data._platform = platform;
  if (data.skills) {
    data.skills = filterSkillsByPlatform(data.skills, platform);
    data.totalCount = data.skills.length;
  }
  if (data.sources) {
    const keep = platform === 'claude'
      ? ['claude-user', 'claude-plugin', 'cc-switch']
      : ['codex-user', 'codex-plugin', 'openai-system', 'cc-switch'];
    const filtered = {};
    for (const [k, v] of Object.entries(data.sources)) {
      if (keep.includes(k)) filtered[k] = v;
    }
    data.sources = filtered;
  }
  return data;
}

function platformLabel() {
  const p = detectPlatform();
  return PLATFORM_LABELS[p] || p;
}

function skillRoots() {
  const home = os.homedir();
  const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
  return [
    { label: 'Claude Code skills path', source: 'claude-user', path: path.join(home, '.claude', 'skills') },
    { label: 'Codex skills path', source: 'codex-user', path: path.join(codexHome, 'skills') },
    { label: 'OpenAI system skills path', source: 'openai-system', path: path.join(codexHome, 'skills', '.system') },
    { label: 'cc-switch skills path', source: 'cc-switch', path: path.join(home, '.cc-switch', 'skills') },
    { label: 'Claude plugin path', source: 'claude-plugin', path: path.join(home, '.claude', 'plugins', 'marketplaces') },
    { label: 'Codex plugin path', source: 'codex-plugin', path: path.join(codexHome, 'plugins', 'cache') },
  ];
}

function walkForSkillFiles(dir, maxDepth, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(full, 'SKILL.md');
    if (fs.existsSync(skillFile)) files.push(skillFile);
    files.push(...walkForSkillFiles(full, maxDepth, currentDepth + 1));
  }
  return files;
}

function readFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

function doctorDetails(data) {
  const roots = skillRoots();
  const skillFiles = roots.flatMap((root) => walkForSkillFiles(root.path, root.source.includes('plugin') ? 4 : 2));
  const malformed = [];
  for (const file of skillFiles) {
    let frontmatter;
    try {
      frontmatter = readFrontmatter(fs.readFileSync(file, 'utf8'));
    } catch (_) {
      frontmatter = null;
    }
    if (!frontmatter || !frontmatter.name || !frontmatter.description) malformed.push(file);
  }

  const duplicateNames = new Map();
  for (const skill of data.skills || []) {
    if ((skill.sources || []).length > 1) duplicateNames.set(skill.name, skill.sources);
  }

  return { roots, malformed, duplicateNames };
}

function printDoctor(data) {
  const details = doctorDetails(data);
  const lines = [
    'Skill Guide Doctor',
    `Node.js: ${process.version}`,
    `Home: ${os.homedir()}`,
    `CODEX_HOME: ${process.env.CODEX_HOME || path.join(os.homedir(), '.codex')}`,
    `Total skills: ${data.totalCount || 0}`,
    'Paths:',
  ];
  for (const root of details.roots) {
    lines.push(`  ${root.label}: ${fs.existsSync(root.path) ? 'exists' : 'missing'} (${root.path})`);
  }
  lines.push(`Duplicate skill names: ${details.duplicateNames.size}`);
  lines.push(`Malformed skill files: ${details.malformed.length}`);
  lines.push(`Suggested Claude Code install: ${path.join(os.homedir(), '.claude', 'skills', 'skill-guide')}`);
  lines.push(`Suggested Codex install: ${path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills', 'skill-guide')}`);
  lines.push(
    'Sources:',
  );
  for (const [source, count] of Object.entries(data.sources || {})) {
    lines.push(`  ${source}: ${count}`);
  }
  lines.push('Status: OK');
  return lines.join('\n');
}

function formatScannerError(data) {
  const lines = [
    data.error || 'Skill not found',
    `Scanned ${data.totalCount || 0} skills.`,
  ];
  if ((data.suggestions || []).length > 0) {
    lines.push('Possible matches:');
    for (const skill of data.suggestions) {
      const sources = (skill.sources || []).join(', ');
      lines.push(`  - ${skill.name}${sources ? ` (${sources})` : ''}`);
    }
  } else {
    lines.push('No close matches found. Try --search <query> to search descriptions and triggers.');
  }
  return lines.join('\n');
}

function renderRecommendTerminal(data, recommendations) {
  const lines = [];
  const totalCategories = new Set(data.skills.map((s) => s.category)).size;

  const groups = groupBy(data.skills, 'category');
  const categoryCounts = Object.entries(groups)
    .filter(([cat]) => cat !== 'other')
    .map(([cat, items]) => ({ cat, count: items.length }))
    .sort((a, b) => b.count - a.count);

  const strongest = categoryCounts[0];
  const weakest = categoryCounts[categoryCounts.length - 1];

  lines.push('');
  lines.push('┌─ skill-guide recommend ─────────────────────┐');
  lines.push('│                                              │');
  lines.push(`│  ${t('yourSkillStack')}: ${data.totalCount} skills, ${totalCategories}/9 ${t('categoriesCovered')}`);
  lines.push('│                                              │');

  if (strongest) {
    lines.push(`│  💪 ${t('strongest')}: ${strongest.cat} (${strongest.count})`);
  }
  if (weakest && weakest !== strongest) {
    lines.push(`│  ⚠️  ${t('weakest')}: ${weakest.cat} (${weakest.count})`);
  }
  lines.push('│');

  const gaps = recommendations.filter((r) => r.type === 'gap');
  if (gaps.length > 0) {
    lines.push(`│  ⚠️  ${t('gapAnalysis')} (${gaps.length}):`);
    for (const gap of gaps) {
      lines.push(`│    • ${gap.category} — 0 skills`);
      if (gap.action) lines.push(`│    💡 ${gap.action}`);
    }
    lines.push('│');
  }

  const overlaps = recommendations.filter((r) => r.type === 'overlap');
  const topOverlaps = [...overlaps].sort((a, b) => b.count - a.count).slice(0, 3);
  if (topOverlaps.length > 0) {
    lines.push(`│  📋 ${t('cleanupOpportunities')}:`);
    for (const overlap of topOverlaps) {
      lines.push(`│    • ${overlap.category} (${overlap.count} skills) — ${t('significantOverlap')}`);
      const top3 = overlap.skills.slice(0, 3);
      if (overlap.completeness) {
        top3.forEach((name, i) => {
          const score = overlap.completeness[i];
          lines.push(`│      ${i + 1}. ${name} (${score}/100)`);
        });
      }
      lines.push(`│      ${t('basedOnCompleteness')}`);
    }
    lines.push('│');
  }

  const popular = recommendations.filter((r) => r.type === 'popular');
  if (popular.length > 0) {
    lines.push(`│  🔥 ${t('popularYoureMissing')}:`);
    for (const skill of popular.filter((s) => s.url).slice(0, 5)) {
      lines.push(`│    • ${skill.name} (${skill.message})`);
    }
    lines.push('│');
  }

  lines.push('└──────────────────────────────────────────────┘');
  lines.push('');
  return lines.join('\n');
}

function renderRecommendHTML(data, recommendations, user) {
  const totalCategories = new Set(data.skills.map((s) => s.category)).size;
  const gaps = recommendations.filter((r) => r.type === 'gap');
  const popular = recommendations.filter((r) => r.type === 'popular');
  const overlaps = recommendations.filter((r) => r.type === 'overlap');

  // Sort overlaps by count descending, take top 3
  const topOverlaps = [...overlaps].sort((a, b) => b.count - a.count).slice(0, 3);

  const categoryBreakdown = Object.entries(
    data.skills.reduce((acc, s) => { const c = s.category || 'other'; acc[c] = (acc[c] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  const breakdownColors = {
    testing: '#10b981', design: '#f59e0b', security: '#ef4444', documentation: '#8b5cf6',
    automation: '#06b6d4', deployment: '#ec4899', 'code-quality': '#14b8a6', development: '#f97316', other: '#6b7280',
  };

  // Stack overview
  const categoryCounts = categoryBreakdown.filter(([cat]) => cat !== 'other');
  const strongest = categoryCounts[0];
  const weakest = categoryCounts[categoryCounts.length - 1];

  const gapCards = gaps.map((gap) => `
    <article class="card gap-card">
      <h3>${escapeHtml(gap.category)}</h3>
      <p>${escapeHtml(t('noSkillsInCategory').replace('{category}', gap.category))}</p>
      ${gap.action ? `<p class="meta">${escapeHtml(gap.action)}</p>` : ''}
      ${gap.skills.length > 0 ? `<div class="chips">${gap.skills.map((s) =>
        `<a href="${escapeHtml(s.url || '#')}" class="chip" title="${escapeHtml(s.description)}">${escapeHtml(s.name)}</a>`
      ).join('')}</div>` : ''}
    </article>
  `).join('');

  const popularItems = popular.filter((s) => s.url).slice(0, 5).map((skill) => `
    <article class="card popular-card">
      <h3>${escapeHtml(skill.name)}</h3>
      <p>${escapeHtml(skill.description || '')}</p>
      <p class="meta">${escapeHtml(skill.message)}</p>
      <a href="${escapeHtml(skill.url)}" class="link">GitHub →</a>
    </article>
  `).join('');

  const overlapItems = topOverlaps.map((overlap) => {
    const skillsWithScores = overlap.skills.map((name, i) => {
      const score = overlap.completeness ? overlap.completeness[i] : null;
      return { name, score };
    });
    return `
    <article class="card overlap-card">
      <h3>${escapeHtml(overlap.category)} <span class="count">${overlap.count}</span></h3>
      <p>${escapeHtml(t('significantOverlap'))}</p>
      <p class="meta">${escapeHtml(t('mostDocumented'))}</p>
      <div class="skill-scores">${skillsWithScores.filter((s) => s.score !== null).map((s) =>
        `<div class="score-row"><span class="score-name">${escapeHtml(s.name)}</span><span class="score-value">${s.score}/100</span></div>`
      ).join('')}</div>
      <p class="meta score-label">${escapeHtml(t('basedOnCompleteness'))}</p>
      <div class="chips">${overlap.skills.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}${
        overlap.hasMore ? `<span class="chip-more">${escapeHtml(t('nMore').replace('{count}', overlap.remainingCount))}</span>` : ''
      }</div>
    </article>
  `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t('skillRecommendations'))}</title>
<meta property="og:title" content="${escapeHtml(t('skillRecommendations'))} — skill-guide">
<meta property="og:description" content="${escapeHtml(t('yourSkillStack'))}: ${data.totalCount} skills, ${totalCategories}/9 ${t('categoriesCovered')}">
<style>
  :root{--bg:#0f0f23;--card:#1a1a2e;--text:#e0e0e0;--muted:#888;--accent:#7c3aed;--accent2:#06b6d4;--gap:#f59e0b;--overlap:#ef4444;--popular:#10b981}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;padding:2rem}
  .container{max-width:960px;margin:0 auto}
  h1{font-size:2.5rem;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem}
  h2{font-size:1.5rem;margin:2rem 0 1rem;color:var(--accent2)}
  .stats{display:flex;gap:1rem;margin:1rem 0;flex-wrap:wrap}
  .stat{background:var(--card);padding:1rem 1.5rem;border-radius:12px;text-align:center}
  .stat b{font-size:2rem;display:block}
  .overview{background:var(--card);padding:1.5rem;border-radius:12px;margin:1.5rem 0;border:1px solid rgba(255,255,255,0.05)}
  .overview p{margin:0.5rem 0;font-size:1rem}
  .overview strong{color:var(--accent)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
  .card{background:var(--card);padding:1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.05)}
  .card h3{margin-bottom:0.5rem;font-size:1.1rem;display:flex;align-items:center;gap:0.5rem}
  .card .count{background:rgba(124,58,237,0.2);padding:0.15rem 0.5rem;border-radius:999px;font-size:0.8rem;color:var(--accent)}
  .card p{color:var(--muted);font-size:0.9rem}
  .card .meta{font-size:0.8rem;margin-top:0.5rem}
  .gap-card{border-left:3px solid var(--gap)}
  .overlap-card{border-left:3px solid var(--overlap)}
  .popular-card{border-left:3px solid var(--popular)}
  .chips{display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem}
  .chip{background:rgba(124,58,237,0.2);padding:0.25rem 0.75rem;border-radius:999px;font-size:0.85rem;text-decoration:none;color:var(--accent);transition:background 0.2s}
  .chip:hover{background:rgba(124,58,237,0.4)}
  .chip-more{background:rgba(255,255,255,0.05);padding:0.25rem 0.75rem;border-radius:999px;font-size:0.85rem;color:var(--muted)}
  .link{color:var(--accent2);text-decoration:none;font-size:0.85rem}
  .link:hover{text-decoration:underline}
  .skill-scores{margin:0.75rem 0}
  .score-row{display:flex;justify-content:space-between;padding:0.25rem 0;font-size:0.9rem}
  .score-name{color:var(--text)}
  .score-value{color:var(--accent);font-family:monospace}
  .score-label{color:var(--muted);font-size:0.75rem;font-style:italic}
  .cta{text-align:center;margin:3rem 0;padding:2rem;background:linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.1));border-radius:16px}
  .cta h2{margin:0 0 0.5rem}
  .cta code{background:var(--card);padding:0.5rem 1rem;border-radius:8px;font-size:1.1rem;display:inline-block;margin:0.5rem 0}
  .cta a{color:var(--accent);text-decoration:none}
  .cta-sub{color:var(--muted);margin:0.5rem 0 1.5rem;font-size:1rem}
  .cta-actions{display:flex;gap:1rem;justify-content:center;margin-top:1.5rem}
  .cta-btn{display:inline-block;padding:0.75rem 2rem;border-radius:8px;font-weight:600;text-decoration:none;font-size:1rem;transition:transform 0.2s,box-shadow 0.2s}
  .cta-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(124,58,237,0.3)}
  .cta-btn.primary{background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff}
  .user-tag{color:var(--muted);font-size:0.9rem;margin-bottom:1rem}
  .breakdown-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:1rem 0 0.5rem}
  .breakdown-segment{min-width:2px;transition:width 0.3s}
  .breakdown-legend{display:flex;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.5rem}
  .legend-item{display:flex;align-items:center;gap:0.35rem;font-size:0.8rem;color:var(--muted)}
  .legend-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
</style>
</head>
<body>
<div class="container">
  ${user ? `<p class="user-tag">${escapeHtml(t('sharedBy').replace('{user}', user))}</p>` : ''}
  <h1>${escapeHtml(t('skillRecommendations'))}</h1>
  <div class="stats">
    <div class="stat"><b>${data.totalCount}</b><span>${t('skillsScanned')}</span></div>
    <div class="stat"><b>${totalCategories}/9</b><span>${t('categoriesCovered')}</span></div>
  </div>
  <div class="breakdown-bar">${categoryBreakdown.map(([cat, count]) => {
    const pct = Math.round((count / data.totalCount) * 100);
    const color = breakdownColors[cat] || '#6b7280';
    return `<div class="breakdown-segment" style="width:${pct}%;background:${color}" title="${cat}: ${count} (${pct}%)"></div>`;
  }).join('')}</div>
  <div class="breakdown-legend">${categoryBreakdown.map(([cat, count]) =>
    `<span class="legend-item"><span class="legend-dot" style="background:${breakdownColors[cat] || '#6b7280'}"></span>${escapeHtml(cat)} (${count})</span>`
  ).join('')}</div>

  <div class="overview">
    ${strongest ? `<p>💪 <strong>${escapeHtml(t('strongest'))}:</strong> ${escapeHtml(strongest[0])} (${strongest[1]} skills)</p>` : ''}
    ${weakest ? `<p>⚠️ <strong>${escapeHtml(t('weakest'))}:</strong> ${escapeHtml(weakest[0])} (${weakest[1]} skills)</p>` : ''}
  </div>

  ${topOverlaps.length > 0 ? `<h2>${escapeHtml(t('cleanupOpportunities'))}</h2><div class="grid">${overlapItems}</div>` : ''}
  ${popular.length > 0 ? `<h2>🔥 ${escapeHtml(t('popularYoureMissing'))}</h2><div class="grid">${popularItems}</div>` : ''}
  ${gaps.length > 0 ? `<h2>Gap Analysis</h2><div class="grid">${gapCards}</div>` : ''}

  <div class="cta">
    <h2>${escapeHtml(t('ctaHeadline'))}</h2>
    <p class="cta-sub">${escapeHtml(t('ctaSubtext'))}</p>
    <code>npx skill-guide --open</code>
    <div class="cta-actions">
      <a href="https://github.com/gtskevin/skill-guide" class="cta-btn primary">${escapeHtml(t('ctaGithub'))}</a>
    </div>
  </div>
</div>
</body>
</html>`;
}


function renderDimensionRadar(dimensions) {
  const size = 280;
  const center = size / 2;
  const radius = 100;
  const levels = 5;
  const n = dimensions.length;

  function polygonPoints(r) {
    return Array.from({ length: n }, (_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');
  }

  const dataPoints = dimensions.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (d.score / 100) * radius;
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
  }).join(' ');

  const labels = dimensions.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const labelR = radius + 22;
    const x = center + labelR * Math.cos(angle);
    const y = center + labelR * Math.sin(angle);
    const anchor = i === 0 || i === n / 2 ? 'middle' : i < n / 2 ? 'start' : 'end';
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#94a3b8" font-size="10" font-family="monospace">${d.name}</text>`;
  }).join('');

  const scoreLabels = dimensions.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (d.score / 100) * radius;
    const x = center + (r + 12) * Math.cos(angle);
    const y = center + (r + 12) * Math.sin(angle);
    return `<text x="${x}" y="${y}" text-anchor="middle" fill="#e2e8f0" font-size="10" font-weight="600">${d.score}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" style="max-width:280px;margin:0 auto;display:block">
      ${Array.from({ length: levels }, (_, i) => {
        const r = (radius / levels) * (i + 1);
        return `<polygon points="${polygonPoints(r)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
      }).join('')}
      <polygon points="${dataPoints}" fill="rgba(34,197,94,0.15)" stroke="#22c55e" stroke-width="2"/>
      ${labels}
      ${scoreLabels}
    </svg>
  `;
}

function renderRadarChart(skills) {
  const CATEGORIES = ['testing', 'design', 'security', 'documentation', 'automation', 'deployment', 'code-quality', 'development'];
  const LABELS_SHORT = ['Test', 'Design', 'Security', 'Docs', 'Auto', 'Deploy', 'Quality', 'Dev'];

  const counts = {};
  for (const cat of CATEGORIES) counts[cat] = 0;
  for (const s of skills) {
    const cat = s.category || 'other';
    if (counts[cat] !== undefined) counts[cat]++;
  }

  const maxCount = Math.max(...Object.values(counts), 1);
  const cx = 150, cy = 150, r = 120;
  const angleStep = (2 * Math.PI) / CATEGORIES.length;

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0].map((scale) => {
    const points = CATEGORIES.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + r * scale * Math.cos(angle);
      const y = cy + r * scale * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
    return `<polygon points="${points}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  }).join('\n    ');

  // Data polygon
  const dataPoints = CATEGORIES.map((cat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const value = counts[cat] / maxCount;
    const x = cx + r * value * Math.cos(angle);
    const y = cy + r * value * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  // Labels
  const labels = CATEGORIES.map((cat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const lx = cx + (r + 25) * Math.cos(angle);
    const ly = cy + (r + 25) * Math.sin(angle);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#888" font-size="11">${LABELS_SHORT[i]}</text>`;
  }).join('\n    ');

  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" class="radar-chart">
    ${rings}
    <polygon points="${dataPoints}" fill="rgba(124,58,237,0.2)" stroke="#7c3aed" stroke-width="2"/>
    ${labels}
  </svg>`;
}

function generatePersona(skills) {
  const categories = {};
  for (const s of skills) {
    const cat = s.category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  }

  const total = skills.length;
  const personas = [];

  if ((categories.security || 0) / total > 0.15) personas.push('Security Champion');
  if ((categories.testing || 0) / total > 0.15) personas.push('Quality Engineer');
  if ((categories.deployment || 0) / total > 0.15) personas.push('DevOps Builder');
  if ((categories.automation || 0) / total > 0.15) personas.push('Automation Architect');
  if ((categories.design || 0) / total > 0.15) personas.push('Design System Crafter');
  if ((categories.documentation || 0) / total > 0.1) personas.push('Documentation Advocate');
  if ((categories['code-quality'] || 0) / total > 0.1) personas.push('Code Quality Guardian');

  if (personas.length === 0) {
    if (total > 50) personas.push('Skill Collector');
    else if (total > 20) personas.push('Full-Stack Explorer');
    else personas.push('Focused Builder');
  }

  return personas.slice(0, 2).join(' · ');
}

function isGarbage(text) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (trimmed.length <= 2) return true;
  if (/^[>|](-|\+)?$/.test(trimmed)) return true;
  if (/^---/.test(trimmed)) return true;
  if (/^(category|tags|name|description)\s*:/.test(trimmed)) return true;
  return false;
}

function capabilityPrefix(count) {
  if (count >= 20) return 'Extensive coverage.';
  if (count >= 10) return 'Solid coverage.';
  if (count >= 3) return 'Some coverage.';
  return 'Getting started.';
}

function renderShareHTML(data, user) {
  const groups = groupBy(data.skills, 'category');
  const totalCategories = Object.keys(groups).length;
  const persona = generatePersona(data.skills);
  const radarChart = renderRadarChart(data.skills);

  // Capability map: one entry per non-empty category (excluding "other")
  const capabilityCards = Object.entries(groups)
    .filter(([cat]) => cat !== 'other')
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, items]) => {
      const prefix = capabilityPrefix(items.length);
      const example = items.find((s) => s.description) || items[0];
      const desc = isGarbage(example?.description) ? '' : truncate(example?.description || '', 80);
      return `
        <article class="card cap-card">
          <h3>${escapeHtml(category)} <span class="count">${items.length}</span></h3>
          <p class="cap-prefix">${escapeHtml(prefix)}</p>
          ${desc ? `<p class="cap-desc">${escapeHtml(desc)}</p>` : ''}
          ${example ? `<p class="cap-example">e.g. ${escapeHtml(example.name)}</p>` : ''}
        </article>
      `;
    }).join('');

  // Stack insights
  const categoryCounts = Object.entries(groups)
    .filter(([cat]) => cat !== 'other')
    .map(([cat, items]) => ({ cat, count: items.length }))
    .sort((a, b) => b.count - a.count);

  const strongest = categoryCounts[0];
  const weakest = categoryCounts[categoryCounts.length - 1];

  const ALL_CATS = ['testing', 'design', 'security', 'documentation', 'automation', 'deployment', 'code-quality', 'development'];
  const missingCats = ALL_CATS.filter((cat) => !groups[cat] || groups[cat].length === 0);
  const gapCategory = missingCats[0] || (weakest && weakest.count <= 2 ? weakest.cat : null);

  const insightsSection = `
    <h2>${escapeHtml(t('stackInsights'))}</h2>
    <div class="insights">
      ${strongest ? `<p class="insight-strong">💪 ${escapeHtml(t('strongest'))}: ${escapeHtml(strongest.cat)} (${strongest.count} skills)</p>` : ''}
      ${gapCategory ? `<p class="insight-gap">⚠️ Gap: ${escapeHtml(gapCategory)} (${groups[gapCategory]?.length || 0} skills)<br><span class="gap-hint">${escapeHtml(t('gapHint').replace('{action}', registryModule.GAP_ACTIONS[gapCategory] || ''))}</span></p>` : ''}
      <p class="insight-cta">Run <code>--recommend</code> for full analysis</p>
    </div>
  `;

  // OG tags
  const ogTitle = `${escapeHtml(persona)} · ${data.totalCount} AI Skills — skill-guide`;
  const topCapabilities = Object.entries(groups)
    .filter(([cat]) => cat !== 'other')
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([, items]) => items[0]?.name)
    .filter(Boolean);
  const ogDescription = topCapabilities.length > 0
    ? `I can ${topCapabilities.join(', ')}. Here's my full AI skill stack.`
    : `${data.totalCount} skills across ${totalCategories} categories`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t('myAiSkillStack'))} — skill-guide</title>
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${escapeHtml(ogDescription)}">
<meta property="og:type" content="website">
<style>
  :root{--bg:#0f0f23;--card:#1a1a2e;--text:#e0e0e0;--muted:#888;--accent:#7c3aed;--accent2:#06b6d4;--pick:#10b981;--gap:#f59e0b}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;padding:2rem}
  .container{max-width:960px;margin:0 auto}
  .hero{text-align:center;padding:3rem 0}
  h1{font-size:2.5rem;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem}
  h2{font-size:1.5rem;margin:2.5rem 0 1rem;color:var(--accent2)}
  .pain{font-size:1.8rem;color:var(--text);font-weight:700;margin:0.5rem 0}
  .persona{font-size:1.3rem;color:var(--accent);font-weight:600;margin:0.5rem 0;letter-spacing:0.05em}
  .user-tag{color:var(--muted);font-size:0.9rem;margin-bottom:0.5rem}
  .subtitle{color:var(--muted);font-size:1rem}
  .stats{display:flex;gap:1.5rem;justify-content:center;margin:1.5rem 0}
  .stat{background:var(--card);padding:1rem 2rem;border-radius:12px;text-align:center;min-width:120px}
  .stat b{font-size:2.5rem;display:block;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .stat span{color:var(--muted);font-size:0.85rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
  .card{background:var(--card);padding:1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.05)}
  .card h3{margin-bottom:0.5rem;font-size:1.1rem;display:flex;align-items:center;gap:0.5rem}
  .card .count{background:rgba(124,58,237,0.2);padding:0.15rem 0.5rem;border-radius:999px;font-size:0.8rem;color:var(--accent)}
  .cap-prefix{color:var(--accent);font-size:0.9rem;font-weight:600;margin:0.25rem 0}
  .cap-desc{color:var(--muted);font-size:0.9rem}
  .cap-example{color:var(--muted);font-size:0.8rem;font-style:italic;margin-top:0.5rem}
  .insights{background:var(--card);padding:1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.05)}
  .insight-strong{color:var(--pick);font-size:1.1rem;margin:0.5rem 0}
  .insight-gap{color:var(--gap);font-size:1.1rem;margin:0.5rem 0}
  .gap-hint{color:var(--muted);font-size:0.9rem;font-weight:normal}
  .insight-cta{color:var(--muted);font-size:0.9rem;margin-top:1rem}
  .insight-cta code{background:rgba(124,58,237,0.2);padding:0.15rem 0.5rem;border-radius:4px;color:var(--accent)}
  .radar-container{display:flex;justify-content:center;margin:2rem 0}
  .radar-chart{width:300px;height:300px}
  .cta{text-align:center;margin:3rem 0;padding:2.5rem;background:linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.1));border-radius:16px}
  .cta h2{margin:0 0 0.5rem}
  .cta p{color:var(--muted);margin:0.5rem 0}
  .cta code{background:var(--card);padding:0.5rem 1.5rem;border-radius:8px;font-size:1.2rem;display:inline-block;margin:0.75rem 0;color:var(--accent2)}
  .cta-sub{color:var(--muted);margin:0.5rem 0 1.5rem;font-size:1rem}
  .cta-actions{display:flex;gap:1rem;justify-content:center;margin-top:1.5rem}
  .cta-btn{display:inline-block;padding:0.75rem 2rem;border-radius:8px;font-weight:600;text-decoration:none;font-size:1rem;transition:transform 0.2s,box-shadow 0.2s}
  .cta-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(124,58,237,0.3)}
  .cta-btn.primary{background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff}
  footer{text-align:center;padding:2rem 0;color:var(--muted);font-size:0.8rem}
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    ${user ? `<p class="user-tag">${escapeHtml(t('sharedBy').replace('{user}', user))}</p>` : ''}
    <p class="pain">${escapeHtml(data.totalCount >= 100 ? t('manySkillsPain').replace('{count}', data.totalCount) : t('scatteredSkills'))}</p>
    <h1>${escapeHtml(t('myAiSkillStack'))}</h1>
    <p class="persona">${escapeHtml(persona)}</p>
    <p class="subtitle">${data.totalCount} ${t('skillsScanned')} · ${totalCategories} ${t('categoriesCovered')}</p>
    <div class="radar-container">${radarChart}</div>
    <div class="stats">
      <div class="stat"><b>${data.totalCount}</b><span>${t('skillsScanned')}</span></div>
      <div class="stat"><b>${totalCategories}</b><span>${t('categoriesCovered')}</span></div>
    </div>
  </div>

  <h2>${escapeHtml(t('capabilityMap'))}</h2>
  <div class="grid">${capabilityCards}</div>

  ${insightsSection}

  <div class="cta">
    <h2>${escapeHtml(t('ctaHeadline'))}</h2>
    <p class="cta-sub">${escapeHtml(t('ctaSubtext'))}</p>
    <code>npx skill-guide --open</code>
    <div class="cta-actions">
      <a href="https://github.com/gtskevin/skill-guide" class="cta-btn primary">${escapeHtml(t('ctaGithub'))}</a>
    </div>
  </div>
</div>
<footer>Generated by skill-guide</footer>
</body>
</html>`;
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function computeHealthStats(skills) {
  const CONTEXT_WINDOW = 200_000;
  const DESCRIPTION_BUDGET = 16_000;

  let totalDescriptionLength = 0;
  let totalTokenEstimate = 0;
  const securityFlags = [];
  const duplicates = new Map();

  for (const skill of skills) {
    const descLen = (skill.description || '').length;
    totalDescriptionLength += descLen;
    totalTokenEstimate += estimateTokens(skill.description);

    // Security red flags
    const content = (skill.description || '').toLowerCase();
    const flags = [];
    if (content.includes('curl ') && content.includes(' | ')) flags.push('pipe-from-curl');
    if (content.includes('eval(') || content.includes('exec(')) flags.push('eval-exec');
    if (content.includes('api_key') || content.includes('apikey') || content.includes('token')) flags.push('handles-secrets');
    if (content.includes('rm -rf') || content.includes('rmdir /s')) flags.push('destructive-commands');
    if (flags.length > 0) {
      securityFlags.push({ name: skill.name, flags });
    }

    // Duplicate detection
    const normalizedName = skill.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (duplicates.has(normalizedName)) {
      duplicates.get(normalizedName).push(skill.name);
    } else {
      duplicates.set(normalizedName, [skill.name]);
    }
  }

  const duplicateGroups = [...duplicates.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([normalized, names]) => ({ normalized, names }));

  return {
    totalSkills: skills.length,
    totalDescriptionLength,
    totalTokenEstimate,
    descriptionBudget: DESCRIPTION_BUDGET,
    budgetUsedPercent: Math.round((totalDescriptionLength / DESCRIPTION_BUDGET) * 100),
    staleSkills: [],  // Scanner doesn't pass _mdFile to skill-guide
    securityFlags,
    duplicateGroups,
    contextWindowPercent: Math.round((totalTokenEstimate / CONTEXT_WINDOW) * 100 * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// --review: LLM review brief
// ---------------------------------------------------------------------------
function buildReviewBrief(data, details) {
  const skills = data.skills || [];
  const health = computeHealthStats(skills);
  const items = [];
  let counter = 0;
  function nextId(prefix) { return `${prefix}-${++counter}`; }

  // 1. Security flags
  for (const flag of health.securityFlags) {
    const skill = skills.find(s => s.name === flag.name);
    items.push({
      id: nextId('sec'),
      type: 'security',
      severity: 'high',
      skills: [flag.name],
      evidence: `Patterns: ${flag.flags.join(', ')}`,
      context: `Description: ${truncate(skill?.description || '', 200)}`,
      question: `Does "${flag.name}" actually pose a security risk, or are these patterns used safely in context?`,
      actionHint: 'Review the full skill content. If the patterns are in example code or are safe, dismiss. If genuinely risky, flag for revision.',
    });
  }

  // 2. Duplicate candidates
  for (const group of health.duplicateGroups) {
    const descriptions = group.names.map(n => {
      const s = skills.find(sk => sk.name === n);
      return `${n}: ${truncate(s?.description || '(no description)', 100)}`;
    });
    items.push({
      id: nextId('dup'),
      type: 'duplicate',
      severity: 'medium',
      skills: group.names,
      evidence: `Normalized name: "${group.normalized}"`,
      context: descriptions.join('\n'),
      question: `Are "${group.names.join('" and "')}" truly duplicate skills, or do they serve different purposes despite similar names?`,
      actionHint: 'If they differ in scope or purpose, consider renaming to clarify. If truly redundant, keep the one with better documentation.',
    });
  }

  // 3. Malformed skills
  for (const file of (details.malformed || []).slice(0, 10)) {
    const basename = path.basename(path.dirname(file));
    items.push({
      id: nextId('mal'),
      type: 'malformed',
      severity: 'low',
      skills: [basename],
      evidence: `Missing frontmatter in: ${file.replace(os.homedir(), '~')}`,
      context: '',
      question: `What name, description, and triggers should be added to the skill at "${basename}"?`,
      actionHint: 'Read the file, understand its purpose, and suggest appropriate frontmatter fields.',
    });
  }

  // 4. Semantic overlap (triggers, tools, tags)
  const overlaps = detectOverlaps(skills);
  for (const overlap of overlaps) {
    overlap.id = nextId('ovr');
    items.push(overlap);
  }

  // 5. Budget overflow
  if (health.budgetUsedPercent > 100) {
    const topConsumers = [...skills]
      .sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0))
      .slice(0, 5);
    items.push({
      id: nextId('bud'),
      type: 'budget',
      severity: 'medium',
      skills: topConsumers.map(s => s.name),
      evidence: `Description budget used: ${health.budgetUsedPercent}% (~${health.totalTokenEstimate} tokens)`,
      context: topConsumers.map(s => `  - ${s.name}: ${(s.description || '').length} chars`).join('\n'),
      question: 'Which skill descriptions should be shortened to fit within the token budget?',
      actionHint: 'Prioritize trimming the longest descriptions. Preserve key information about triggers and use cases.',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalSkills: skills.length,
    totalReviewItems: items.length,
    summary: {
      security: items.filter(i => i.type === 'security').length,
      duplicate: items.filter(i => i.type === 'duplicate').length,
      malformed: items.filter(i => i.type === 'malformed').length,
      overlap: items.filter(i => i.type === 'overlap' || i.type === 'semantic-overlap').length,
      budget: items.filter(i => i.type === 'budget').length,
    },
    items,
  };
}

function buildCopyPrompt(brief) {
  const lines = [
    `Review the following ${brief.totalReviewItems} findings from skill-guide and provide your assessment.`,
    '',
  ];
  for (const item of brief.items) {
    lines.push(`## [${item.severity.toUpperCase()}] ${item.type}: ${item.skills.join(', ')}`);
    lines.push(`Evidence: ${item.evidence}`);
    if (item.context) lines.push(`Context:\n${item.context}`);
    lines.push(`Question: ${item.question}`);
    lines.push('');
  }
  lines.push('For each item, respond with: CONFIRM (agree with the finding), DISMISS (false positive with reason), or SUGGEST (alternative action).');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Lint: Review Readiness scoring
// ---------------------------------------------------------------------------
// Overlap detection: Jaccard similarity on triggers, tools, tags
// ---------------------------------------------------------------------------

function jaccard(setA, setB) {
  if (!setA.length || !setB.length) return 0;
  const a = new Set(setA.map(s => s.toLowerCase().trim()));
  const b = new Set(setB.map(s => s.toLowerCase().trim()));
  let intersection = 0;
  for (const item of a) { if (b.has(item)) intersection++; }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function detectOverlaps(skills) {
  const THRESHOLDS = { triggers: 0.5, allowedTools: 0.6, tags: 0.5 };
  const groups = {};
  for (const s of skills) {
    const cat = s.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }

  const results = [];
  const seen = new Set();

  for (const catSkills of Object.values(groups)) {
    for (let i = 0; i < catSkills.length; i++) {
      for (let j = i + 1; j < catSkills.length; j++) {
        const a = catSkills[i];
        const b = catSkills[j];

        for (const [dimension, threshold] of Object.entries(THRESHOLDS)) {
          const arrA = Array.isArray(a[dimension]) ? a[dimension] : [];
          const arrB = Array.isArray(b[dimension]) ? b[dimension] : [];
          if (!arrA.length || !arrB.length) continue;

          const sim = jaccard(arrA, arrB);
          if (sim < threshold) continue;

          const key = [a.name, b.name, dimension].sort().join('||');
          if (seen.has(key)) continue;
          seen.add(key);

          const setA = new Set(arrA.map(s => s.toLowerCase().trim()));
          const setB = new Set(arrB.map(s => s.toLowerCase().trim()));
          const shared = [...setA].filter(x => setB.has(x));
          const onlyA = [...setA].filter(x => !setB.has(x));
          const onlyB = [...setB].filter(x => !setA.has(x));

          const pct = Math.round(sim * 100);
          const severity = sim >= 0.8 ? 'high' : 'medium';
          const fieldLabel = dimension === 'triggers' ? 'Triggers' : dimension === 'allowedTools' ? 'Allowed tools' : 'Tags';

          results.push({
            type: 'semantic-overlap',
            severity,
            skills: [a.name, b.name],
            evidence: `${fieldLabel}: ${pct}% overlap (${shared.length}/${new Set([...arrA, ...arrB].map(s => s.toLowerCase().trim())).size} shared)`,
            context: [
              `Shared: ${shared.map(s => `"${s}"`).join(', ') || '(none)'}`,
              onlyA.length ? `Only in ${a.name}: ${onlyA.map(s => `"${s}"`).join(', ')}` : null,
              onlyB.length ? `Only in ${b.name}: ${onlyB.map(s => `"${s}"`).join(', ')}` : null,
            ].filter(Boolean).join('\n'),
            dimension,
            similarity: Math.round(sim * 100) / 100,
            question: `Do "${a.name}" and "${b.name}" serve different purposes despite ${pct}% ${fieldLabel.toLowerCase()} overlap?`,
            actionHint: 'If they cover the same scenarios, consider consolidating. If complementary, add clearer triggers or descriptions to distinguish them.',
          });
        }
      }
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  results.forEach((r, i) => { r.id = `ovr-sem-${i + 1}`; });
  return results;
}

// ---------------------------------------------------------------------------
const LINT_PATTERNS = {
  whenToUse:   /when\s+(?:to\s+)?use|何时用|适用场景/i,
  howItWorks:  /how\s+it\s+works|运作原理|how\s+to\s+use|workflow|流程/i,
  limitations: /limit|局限|not\s+do|anti.?pattern|caveat|注意事项/i,
  examples:    /example|实例|demo|sample/i,
};
const GENERIC_TRIGGERS = /^(use\s+(this\s+)?(when\s+)?(needed|appropriate|relevant|required)|按需|需要时使用)$/i;

function lintExtractContextual(bodyContent) {
  const result = { whenToUse: '', howItWorks: '', limitations: '', examples: '' };
  const cleaned = bodyContent.replace(/```[\s\S]*?```/g, '');
  const paragraphs = cleaned.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    const lines = trimmed.split('\n').filter(l => !l.startsWith('|') && !l.match(/^!\[/) && l.trim().length > 0);
    const text = lines.join(' ').trim();
    if (text.length < 20 || text.length > 800) continue;
    for (const [key, regex] of Object.entries(LINT_PATTERNS)) {
      if (!result[key] && regex.test(text)) result[key] = text.slice(0, 500);
    }
  }
  return result;
}

function lintSingleSkill(skill, bodyData) {
  const issues = [];
  const desc = (skill.description || '').trim();
  const descLen = desc.length;
  const triggers = Array.isArray(skill.triggers) ? skill.triggers : skill.triggers ? [skill.triggers] : [];
  const tools = Array.isArray(skill.allowedTools || skill['allowed-tools'])
    ? (skill.allowedTools || skill['allowed-tools'])
    : typeof (skill.allowedTools || skill['allowed-tools']) === 'string'
      ? [(skill.allowedTools || skill['allowed-tools'])]
      : [];
  const ctx = bodyData || {};

  // Dimension 1: Metadata Completeness (0-100)
  let meta = 0;
  if (skill.name) meta += 25; else issues.push({ id: 'meta-no-name', dimension: 'metadata', message: 'Missing skill name in frontmatter', severity: 'error' });
  if (desc) meta += 25; else issues.push({ id: 'meta-no-desc', dimension: 'metadata', message: 'No description provided', severity: 'error' });
  if (descLen >= 50) meta += 15;
  else if (descLen > 0) { meta += 5; issues.push({ id: 'meta-short-desc', dimension: 'metadata', message: `Description too short (${descLen} chars, recommended 50+)`, severity: 'warning' }); }
  if (triggers.length > 0) meta += 15; else issues.push({ id: 'meta-no-triggers', dimension: 'metadata', message: 'No triggers defined — agent may not know when to activate', severity: 'warning' });
  if (tools.length > 0) meta += 10; else issues.push({ id: 'meta-no-tools', dimension: 'metadata', message: 'No allowed-tools declared', severity: 'info' });
  if (skill.tags && (Array.isArray(skill.tags) ? skill.tags : [skill.tags]).length > 0) meta += 10;

  // Dimension 2: Activation Clarity (0-100)
  let activ = 0;
  if (ctx.whenToUse && ctx.whenToUse.length > 30) activ += 30;
  else issues.push({ id: 'activ-no-when', dimension: 'activation', message: "Missing 'When to Use' section", severity: 'warning' });
  const hasGeneric = triggers.some(t => GENERIC_TRIGGERS.test(String(t).trim()));
  if (!hasGeneric && triggers.length > 0) activ += 25;
  else if (hasGeneric) { activ += 5; issues.push({ id: 'activ-generic-trigger', dimension: 'activation', message: 'Trigger is overly generic (e.g. "use when needed")', severity: 'warning' }); }
  if (triggers.length >= 2) activ += 25; else if (triggers.length === 1) activ += 10;
  if (ctx.examples && ctx.examples.length > 30) activ += 20;
  else issues.push({ id: 'activ-no-examples', dimension: 'activation', message: 'No examples found', severity: 'info' });

  // Dimension 3: Scope Clarity (0-100)
  let scope = 0;
  if (ctx.limitations && ctx.limitations.length > 30) scope += 30;
  else issues.push({ id: 'scope-no-limits', dimension: 'scope', message: 'Missing Limitations section — agents may apply skill inappropriately', severity: 'warning' });
  if (ctx.howItWorks && ctx.howItWorks.length > 30) scope += 20;
  else issues.push({ id: 'scope-no-how', dimension: 'scope', message: "Missing 'How It Works' section", severity: 'info' });
  const body = [ctx.whenToUse, ctx.howItWorks, ctx.limitations, desc].join(' ');
  if (/do\s+not|don'?t|avoid|never|不要|避免/i.test(body)) scope += 20;
  else issues.push({ id: 'scope-no-negatives', dimension: 'scope', message: 'Missing negative use cases (when NOT to use)', severity: 'info' });
  if (descLen > 0 && descLen < 1000) scope += 15; else if (descLen > 0) scope += 5;
  if (ctx.examples && ctx.examples.length > 30) scope += 15;

  // Dimension 4: Context Efficiency (0-100)
  let effcy = 0;
  if (descLen >= 50 && descLen <= 1000) effcy += 40;
  else if (descLen > 1000) { effcy += 10; issues.push({ id: 'ctx-long-desc', dimension: 'context', message: `Description too long (${descLen} chars, recommended ≤1000)`, severity: 'warning' }); }
  else if (descLen > 0) effcy += 15;
  const summary = (ctx.summary || '').trim();
  if (desc && summary && desc !== summary) effcy += 20;
  else if (desc && summary && desc === summary) issues.push({ id: 'ctx-redundant', dimension: 'context', message: 'Description and summary are identical', severity: 'info' });
  const tokens = descLen ? Math.round(descLen / 4) : 0;
  if (tokens <= 500) effcy += 20; else { effcy += 5; issues.push({ id: 'ctx-high-tokens', dimension: 'context', message: `Description token estimate high (~${tokens})`, severity: 'info' }); }
  if (desc && !desc.replace(/^["']|["']$/g, '').startsWith('---')) effcy += 20;
  else if (desc) issues.push({ id: 'ctx-yaml-leak', dimension: 'context', message: 'YAML artifact leaked into description', severity: 'error' });

  // Dimension 5: Review Priority (0-100)
  let revpr = 100;
  if (tools.some(t => String(t).trim() === 'Bash')) {
    revpr -= 10;
    issues.push({ id: 'rev-broad-bash', dimension: 'review', message: 'Bash tool declared without scope restriction', severity: 'warning' });
  }
  if (/\beval\(|exec\(/.test(body)) { revpr -= 10; issues.push({ id: 'rev-shell-exec', dimension: 'review', message: 'Shell execution patterns detected (eval/exec)', severity: 'warning' }); }
  if (/\bapi[_-]?key|token|password|secret\b/i.test(body)) { revpr -= 10; issues.push({ id: 'rev-credentials', dimension: 'review', message: 'Credential-related keywords detected', severity: 'warning' }); }
  if (/\brm\s+-rf|rmdir/i.test(body)) { revpr -= 10; issues.push({ id: 'rev-destructive', dimension: 'review', message: 'Destructive command patterns detected', severity: 'warning' }); }
  if (!skill.name) revpr -= 15;
  if (!desc) revpr -= 15;
  revpr = Math.max(0, revpr);

  const dimensions = [
    { name: 'Metadata', score: meta },
    { name: 'Activation', score: activ },
    { name: 'Scope', score: scope },
    { name: 'Context', score: effcy },
    { name: 'Review', score: revpr },
  ];
  const overall = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);

  return { dimensions, overall, issues };
}

function lintSkillFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fm = readFrontmatter(content) || {};
  const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const contextual = lintExtractContextual(bodyContent);

  // readFrontmatter only parses simple key: value; re-parse arrays from raw frontmatter
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const fmRaw = fmMatch ? fmMatch[1] : '';
  const extractArray = (key) => {
    const lines = fmRaw.split('\n');
    const result = [];
    let collecting = false;
    for (const line of lines) {
      if (line.match(new RegExp(`^${key}\\s*:`))) {
        collecting = true;
        const inlineVal = line.replace(new RegExp(`^${key}\\s*:\\s*`), '').trim();
        if (inlineVal && inlineVal !== '') {
          // Single-line array: key: val1, val2
          result.push(...inlineVal.split(/[,，]/).map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean));
        }
        continue;
      }
      if (collecting) {
        const item = line.match(/^\s+-\s+(.+)/);
        if (item) { result.push(item[1].trim().replace(/^['"]|['"]$/g, '')); }
        else if (!line.match(/^\s/)) { collecting = false; }
      }
    }
    return result;
  };

  const skill = {
    name: (fm.name || path.basename(path.dirname(filePath))).replace(/^["']|["']$/g, ''),
    description: (fm.description || '').replace(/^["']|["']$/g, ''),
    triggers: extractArray('triggers'),
    allowedTools: extractArray('allowed-tools').concat(extractArray('allowedTools')),
    tags: extractArray('tags'),
  };

  const bodyData = { ...contextual, summary: bodyContent.split(/\n\s*\n/)[0]?.trim() || '' };
  return { file: filePath, name: skill.name, result: lintSingleSkill(skill, bodyData) };
}

function lintAllSkills(data) {
  // Only lint roots for the current platform
  const platform = detectPlatform();
  const allRoots = skillRoots();
  const keepSources = platform === 'all'
    ? null
    : platform === 'claude'
      ? ['claude-user', 'claude-plugin', 'cc-switch']
      : ['codex-user', 'codex-plugin', 'openai-system', 'cc-switch'];
  const roots = keepSources ? allRoots.filter(r => keepSources.includes(r.source)) : allRoots;

  const skillFiles = roots.flatMap(r => walkForSkillFiles(r.path, r.source.includes('plugin') ? 4 : 2));
  const results = [];
  const seen = new Set();
  for (const f of skillFiles) {
    const normalized = f.replace(/\\/g, '/');
    // Skip plugin command files — they are not SKILL.md definitions
    if (normalized.includes('/commands/') || normalized.includes('\\commands\\')) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(lintSkillFile(f));
  }

  // Also include any scanner skills that weren't found as files (best-effort)
  const lintedNames = new Set(results.map(r => r.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
  for (const skill of data.skills || []) {
    const key = (skill.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lintedNames.has(key)) continue;
    const s = {
      name: skill.name, description: skill.description || '',
      triggers: skill.triggers || [], allowedTools: skill.allowedTools || skill['allowed-tools'] || [],
      tags: skill.tags || [],
    };
    results.push({ file: skill.dir || '(scanner data)', name: s.name, result: lintSingleSkill(s, null) });
    lintedNames.add(key);
  }
  return results;
}

function renderLintTerminal(results) {
  const ready = results.filter(r => r.result.overall >= 70).length;
  const needsWork = results.filter(r => r.result.overall >= 40 && r.result.overall < 70).length;
  const critical = results.filter(r => r.result.overall < 40).length;

  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    `║  skill-guide check · ${results.length} skills · Review Readiness      ║`,
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `  Summary: ${ready} ready, ${needsWork} needs work, ${critical} critical`,
    '',
    '  Name                          Meta  Activ  Scope  Ctx   Rev    Overall',
    '  ─────────────────────────────────────────────────────────────────────',
  ];

  const sorted = [...results].sort((a, b) => a.result.overall - b.result.overall);
  for (const r of sorted) {
    const dims = r.result.dimensions;
    const icon = r.result.overall >= 70 ? '🟢' : r.result.overall >= 40 ? '🟡' : '🔴';
    const name = (r.name || '(unknown)').slice(0, 28).padEnd(28);
    lines.push(`  ${icon} ${name}  ${String(dims[0].score).padStart(3)}   ${String(dims[1].score).padStart(3)}   ${String(dims[2].score).padStart(3)}   ${String(dims[3].score).padStart(3)}   ${String(dims[4].score).padStart(3)}     ${r.result.overall}`);
  }

  lines.push('');
  lines.push('  Legend: 🟢 ≥70 ready   🟡 40-69 needs work   🔴 <40 critical');

  const allIssues = results.flatMap(r => r.result.issues.map(i => ({ ...i, name: r.name })));
  const warnings = allIssues.filter(i => i.severity === 'error' || i.severity === 'warning');
  if (warnings.length > 0) {
    lines.push('');
    lines.push(`  Top issues (${warnings.length}):`);
    for (const w of warnings.slice(0, 15)) {
      lines.push(`    ⚠ ${w.name}: ${w.message}`);
    }
  }

  lines.push('');
  lines.push('  Run with --format json for full details.');
  return lines.join('\n');
}

function renderLintJSON(results) {
  return {
    generatedAt: new Date().toISOString(),
    totalChecked: results.length,
    summary: {
      ready: results.filter(r => r.result.overall >= 70).length,
      needsWork: results.filter(r => r.result.overall >= 40 && r.result.overall < 70).length,
      critical: results.filter(r => r.result.overall < 40).length,
    },
    results: results.map(r => ({
      file: r.file,
      name: r.name,
      overall: r.result.overall,
      dimensions: r.result.dimensions,
      issues: r.result.issues,
    })),
  };
}

function renderOverlapTerminal(overlaps) {
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    `║  skill-guide overlap · ${overlaps.length} overlaps found${' '.repeat(Math.max(0, 22 - String(overlaps.length).length))}║`,
    '╚══════════════════════════════════════════════════════════════╝',
  ];

  if (!overlaps.length) {
    lines.push('', '  No significant overlaps detected.', '');
    return lines.join('\n');
  }

  lines.push(
    '',
    '  Dimension    Skill A                          Skill B                          Similarity',
    '  ─────────────────────────────────────────────────────────────────────────────────────',
  );

  for (const r of overlaps) {
    const dim = r.dimension.padEnd(12);
    const a = r.skills[0].slice(0, 30).padEnd(32);
    const b = r.skills[1].slice(0, 30).padEnd(32);
    const pct = `${Math.round(r.similarity * 100)}%`;
    lines.push(`  ${dim}${a}${b}${pct}`);
  }

  lines.push(
    '',
    '  Legend: high ≥ 80% overlap, medium ≥ 50% overlap',
    '',
  );
  return lines.join('\n');
}

function renderOverlapJSON(overlaps) {
  return {
    generatedAt: new Date().toISOString(),
    totalOverlaps: overlaps.length,
    summary: {
      high: overlaps.filter(o => o.severity === 'high').length,
      medium: overlaps.filter(o => o.severity === 'medium').length,
    },
    results: overlaps,
  };
}

function renderHealthTerminal(data) {
  const skills = data.skills || [];
  const health = computeHealthStats(skills);
  const personality = analyzeSkillPersonality(skills);
  const radar = computeRadarScores(skills, health);
  const topConsumers = renderTopConsumers(skills, 5);
  const prescriptions = generatePrescription(skills, health);
  const isZh = lang() === 'zh';

  const scoreColor = (s) => s >= 80 ? '🟢' : s >= 60 ? '🟡' : '🔴';

  const lines = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║              Skill Health Report                           ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `${scoreColor(radar.overall)} Health Score: ${radar.overall}/100`,
    '',
    `${personality.emoji} ${isZh ? '本地画像' : 'Local profile'}: ${personality.type} (${personality.title})`,
    `   ${personality.description}`,
    '',
    isZh ? '── 你的数据 ─────────────────────────────────────────────' : '── Your Stats ─────────────────────────────────────────────',
    `   📦 ${isZh ? '总技能数' : 'Total Skills'}: ${skills.length}`,
    `   🔤 ${isZh ? '描述 Token 估算' : 'Description Token Estimate'}: ~${(health.totalTokenEstimate / 1000).toFixed(1)}K (${health.contextWindowPercent}% ${isZh ? 'of 200K reference context' : 'of 200K reference context'})`,
    `   📏 ${isZh ? '本地参考预算使用' : 'Local Reference Budget Usage'}: ${health.budgetUsedPercent}%`,
    '',
  ];

  // Description estimate
  const tokenPerSkill = skills.length > 0 ? Math.round(health.totalTokenEstimate / skills.length) : 0;
  lines.push(isZh ? '── 描述估算 ─────────────────────────────────────────────' : '── Description Estimate ─────────────────────────────────');
  lines.push(isZh
    ? `   💡 你的 ${skills.length} 个技能，平均每个 ~${tokenPerSkill} tokens。`
    : `   💡 Your ${skills.length} skills average ~${tokenPerSkill} tokens each.`);
  lines.push(isZh
    ? `      描述总量估算约为 200K 参考 context 的 ${health.contextWindowPercent}%。`
    : `      The estimated description total is ${health.contextWindowPercent}% of a 200K reference context.`);
  lines.push('');

  if (topConsumers.length > 0) {
    lines.push(isZh ? '── Top 5 最长描述 ───────────────────────────────────────' : '── Top 5 Longest Descriptions ─────────────────────────────');
    for (const c of topConsumers) {
      const bar = '█'.repeat(Math.round(c.barWidth / 10)) + '░'.repeat(10 - Math.round(c.barWidth / 10));
      lines.push(`   ${c.rank}. ${c.name} ${bar} ${c.tokenCost.toLocaleString()} tokens`);
    }
    lines.push('');
  }

  if (prescriptions.length > 0) {
    lines.push(isZh ? '── 复核提示 ──────────────────────────────────────────────' : '── Review Prompts ─────────────────────────────────────────');
    for (const p of prescriptions) {
      lines.push(`   ${p.emoji} ${isZh ? p.title : p.titleEn} [${p.impact}]`);
      lines.push(`      ${isZh ? p.description : p.descriptionEn}`);
    }
    lines.push('');
  }

  lines.push(isZh ? '── 五维评分 ──────────────────────────────────────────────' : '── Five Dimensions ────────────────────────────────────────');
  for (const d of radar.dimensions) {
    const bar = '█'.repeat(Math.round(d.score / 10)) + '░'.repeat(10 - Math.round(d.score / 10));
    lines.push(`   ${d.name} ${bar} ${d.score}/100`);
  }
  lines.push('');
  lines.push(isZh ? '💡 使用 --open 打开交互式仪表盘，支持一键分享' : '💡 Run with --open for interactive dashboard with shareable report');

  return lines.join('\n');
}

function renderDefaultTerminal(skills) {
  const isZh = lang() === 'zh';
  const health = computeHealthStats(skills);
  const personality = analyzeSkillPersonality(skills);
  const radar = computeRadarScores(skills, health);
  const wrapped = computeWrappedStats(skills, health);
  const totalTokens = skills.reduce((sum, s) => sum + (s.tokenCost || 0), 0);
  const tokenK = (totalTokens / 1000).toFixed(1);
  const pct = Math.round((totalTokens / 200000) * 100 * 100) / 100;
  const scoreColor = (s) => s >= 80 ? '🟢' : s >= 60 ? '🟡' : '🔴';
  const groups = groupBy(skills, 'category');
  const cats = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  const lines = [
    '╔══════════════════════════════════════════════════════════════╗',
    isZh
      ? `║  skill-guide · ${skills.length} 个技能 · 本地画像：${personality.type}  ║`
      : `║  skill-guide · ${skills.length} skills · Local profile: ${personality.type}  ║`,
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `  ${scoreColor(radar.overall)} ${isZh ? '健康度' : 'Health'}: ${radar.overall}/100`,
    `  ${personality.emoji} ${personality.description}`,
    '',
    `  📦 ${skills.length} ${isZh ? '个技能' : 'skills'} · ${cats.length}/9 ${isZh ? '个领域' : 'categories'} · 🔤 ~${tokenK}K ${isZh ? '描述 tokens' : 'description tokens'} (${pct}% ${isZh ? 'of 200K 参考 context' : 'of 200K reference context'})`,
    `  📍 ${isZh ? '本地画像：仅基于当前扫描结果' : 'Local profile: based only on the current scan'}`,
    '',
  ];

  // Radar
  lines.push(isZh ? '  ── 五维雷达 ──────────────────────────────────────────' : '  ── Radar ──────────────────────────────────────────────');
  for (const d of radar.dimensions) {
    const bar = '█'.repeat(Math.round(d.score / 10)) + '░'.repeat(10 - Math.round(d.score / 10));
    lines.push(`  ${d.name.padEnd(10)} ${bar} ${d.score}/100`);
  }
  lines.push('');

  // Top 3 insights
  lines.push(isZh ? '  ── 关键洞察 ──────────────────────────────────────────' : '  ── Insights ───────────────────────────────────────────');

  // Source breakdown
  const userCount = skills.filter(s => (s.sources || []).some(src => ['claude-user', 'codex-user', 'cc-switch'].includes(src))).length;
  const pluginCount = skills.filter(s => (s.sources || []).some(src => ['claude-plugin', 'codex-plugin'].includes(src))).length;
  lines.push(isZh
    ? `  📂 来源: ${userCount} 个用户目录来源 · ${pluginCount} 个插件目录来源`
    : `  📂 Sources: ${userCount} user-directory · ${pluginCount} plugin-directory`);

  // Dormant skills
  const dormant = wrapped.untappedCount || 0;
  const dormantPct = skills.length > 0 ? Math.round((dormant / skills.length) * 100) : 0;
  if (dormant > 0) {
    lines.push(isZh
      ? `  ⚠️ ${dormant} 个技能（${dormantPct}%）元数据较少 — 建议复核描述和触发词`
      : `  ⚠️ ${dormant} skills (${dormantPct}%) have sparse metadata — review descriptions and triggers`);
  }

  // Budget
  if (pct > 5) {
    lines.push(isZh
      ? `  🔤 描述 Token 估算约为 200K 参考 context 的 ${pct}%`
      : `  🔤 Estimated description tokens: ${pct}% of a 200K reference context`);
  }

  // Short descriptions are review candidates, not usage signals.
  if (wrapped.shortestDescriptions && wrapped.shortestDescriptions.length > 0) {
    lines.push(isZh
      ? `  🔍 描述最短: ${wrapped.shortestDescriptions.slice(0, 3).join(', ')}`
      : `  🔍 Shortest descriptions: ${wrapped.shortestDescriptions.slice(0, 3).join(', ')}`);
  }

  lines.push('');
  lines.push(isZh ? '  💡 使用 --open 打开完整的交互式报告' : '  💡 Run --open for the full interactive report');
  lines.push('');

  return lines.join('\n');
}

function renderInsightTerminal(data) {
  const skills = data.skills || [];
  const health = computeHealthStats(skills);
  const personality = analyzeSkillPersonality(skills);
  const radar = computeRadarScores(skills, health);
  const wrapped = computeWrappedStats(skills, health);
  const isZh = lang() === 'zh';
  const scoreColor = (s) => s >= 80 ? '🟢' : s >= 60 ? '🟡' : '🔴';
  const groups = groupBy(skills, 'category');
  const categoryCounts = Object.entries(groups)
    .filter(([cat]) => cat !== 'other')
    .map(([cat, items]) => ({ cat, count: items.length }))
    .sort((a, b) => b.count - a.count);
  const strongest = categoryCounts[0];
  const weakest = categoryCounts[categoryCounts.length - 1];

  const lines = [
    '╔══════════════════════════════════════════════════════════════╗',
    isZh ? '║              技能洞察报告                                   ║'
         : '║              Skill Insight Report                          ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
  ];

  // Health section
  lines.push(isZh ? '── 健康度 ───────────────────────────────────────────────' : '── Health ─────────────────────────────────────────────────');
  lines.push(`  ${scoreColor(radar.overall)} ${isZh ? '分数' : 'Score'}: ${radar.overall}/100 · ${personality.emoji} ${isZh ? '类型' : 'Type'}: ${personality.type}`);
  lines.push(`  ${personality.description}`);
  lines.push(`  ⚡ ${wrapped.coreCount} ${isZh ? '个元数据较完整' : 'metadata-rich'} | ${wrapped.readyCount} ${isZh ? '个元数据一般' : 'partial metadata'} | ${wrapped.untappedCount} ${isZh ? '个元数据较少' : 'sparse metadata'}`);
  lines.push('');

  // Radar
  lines.push(isZh ? '── 五维评分 ─────────────────────────────────────────────' : '── Dimensions ────────────────────────────────────────────');
  for (const d of radar.dimensions) {
    const bar = '█'.repeat(Math.round(d.score / 10)) + '░'.repeat(10 - Math.round(d.score / 10));
    lines.push(`  ${d.name} ${bar} ${d.score}/100`);
  }
  lines.push('');

  // Budget
  lines.push(isZh ? '── Token 预算 ───────────────────────────────────────────' : '── Token Budget ──────────────────────────────────────────');
  lines.push(isZh
    ? `  📦 ${skills.length} 个技能 · 🔤 ~${(health.totalTokenEstimate / 1000).toFixed(1)}K 描述 tokens（约为 200K 参考 context 的 ${health.contextWindowPercent}%）`
    : `  📦 ${skills.length} skills · 🔤 ~${(health.totalTokenEstimate / 1000).toFixed(1)}K description tokens (${health.contextWindowPercent}% of 200K reference context)`);
  lines.push(isZh
    ? `  📏 本地参考预算使用: ${health.budgetUsedPercent}%`
    : `  📏 Local reference budget usage: ${health.budgetUsedPercent}%`);
  lines.push('');

  // Gaps / cleanup
  lines.push(isZh ? '── 优化建议 ─────────────────────────────────────────────' : '── Gaps & Cleanup ────────────────────────────────────────');
  if (strongest) {
    lines.push(isZh
      ? `  💪 最强领域: ${strongest.cat} (${strongest.count})`
      : `  💪 Strongest: ${strongest.cat} (${strongest.count})`);
  }
  if (weakest && weakest !== strongest) {
    lines.push(isZh
      ? `  ⚠️ 最弱领域: ${weakest.cat} (${weakest.count})`
      : `  ⚠️ Weakest: ${weakest.cat} (${weakest.count})`);
  }
  if (wrapped.shortestDescriptions.length > 0) {
    lines.push(isZh
      ? `  🔍 描述最短: ${wrapped.shortestDescriptions.slice(0, 3).join(', ')}`
      : `  🔍 Shortest descriptions: ${wrapped.shortestDescriptions.slice(0, 3).join(', ')}`);
  }
  lines.push('');

  // CTA
  lines.push(isZh ? '── 下一步 ───────────────────────────────────────────────' : '── Next Steps ────────────────────────────────────────────');
  lines.push(isZh
    ? '  💡 使用 --open 生成完整的交互式 HTML 报告'
    : '  💡 Run with --open for the full interactive HTML report');
  lines.push(isZh
    ? '  🔗 使用 --open 生成可分享的 HTML 报告'
    : '  🔗 Use --open to generate a shareable HTML report');
  lines.push('');

  return lines.join('\n');
}


function renderHealthHTML(data) {
  const skills = data.skills || [];
  const health = computeHealthStats(skills);
  const personality = analyzeSkillPersonality(skills);
  const radar = computeRadarScores(skills, health);
  const topConsumers = renderTopConsumers(skills, 10);
  const prescriptions = generatePrescription(skills, health);

  function renderRadarChart(dimensions) {
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const levels = 5;

    function pentagonPoints(r) {
      return Array.from({ length: 5 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
      }).join(' ');
    }

    const dataPoints = dimensions.map((d, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const r = (d.score / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');

    const labels = dimensions.map((d, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const labelR = radius + 25;
      const x = center + labelR * Math.cos(angle);
      const y = center + labelR * Math.sin(angle);
      const anchor = i === 0 ? 'middle' : i < 3 ? 'start' : 'end';
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#94a3b8" font-size="11">${d.name}</text>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${size} ${size}" class="radar-chart">
        ${Array.from({ length: levels }, (_, i) => {
          const r = (radius / levels) * (i + 1);
          return `<polygon points="${pentagonPoints(r)}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
        }).join('')}
        <polygon points="${dataPoints}" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" stroke-width="2"/>
        ${labels}
      </svg>
    `;
  }

  function scoreColor(score) {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function scoreLabel(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  return `<!DOCTYPE html>
<html lang="${lang()}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Skill Health Report</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #3b82f6;
      --good: #22c55e;
      --warn: #f59e0b;
      --bad: #ef4444;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .hero {
      text-align: center;
      padding: 4rem 2rem;
      background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
    }
    .score-circle {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 auto 2rem;
      border: 4px solid;
    }
    .score-number {
      font-size: 4rem;
      font-weight: 700;
      line-height: 1;
    }
    .score-label {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 0.5rem;
    }
    .personality {
      margin-top: 1rem;
    }
    .personality-emoji {
      font-size: 3rem;
    }
    .personality-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 0.5rem;
    }
    .personality-desc {
      color: var(--muted);
      max-width: 500px;
      margin: 1rem auto;
      line-height: 1.6;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem;
    }
    .section {
      background: var(--card);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .radar-container {
      display: flex;
      justify-content: center;
      padding: 1rem;
    }
    .radar-chart {
      width: 300px;
      height: 300px;
    }
    .consumer-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .consumer-rank {
      width: 24px;
      font-weight: 600;
      color: var(--muted);
    }
    .consumer-name {
      flex: 1;
      font-weight: 500;
    }
    .consumer-bar {
      width: 120px;
      height: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    .consumer-fill {
      height: 100%;
      border-radius: 4px;
      background: var(--accent);
    }
    .consumer-tokens {
      width: 80px;
      text-align: right;
      font-size: 0.875rem;
      color: var(--muted);
    }
    .prescription-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .prescription-card:hover {
      background: rgba(255,255,255,0.08);
    }
    .prescription-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }
    .prescription-emoji {
      font-size: 1.5rem;
    }
    .prescription-title {
      font-weight: 600;
      flex: 1;
    }
    .prescription-impact {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .impact-high { background: rgba(239,68,68,0.2); color: #ef4444; }
    .impact-medium { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .impact-low { background: rgba(34,197,94,0.2); color: #22c55e; }
    .prescription-desc {
      color: var(--muted);
      font-size: 0.875rem;
    }
    .prescription-items {
      margin-top: 1rem;
      display: none;
    }
    .prescription-card.expanded .prescription-items {
      display: block;
    }
    .prescription-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      font-size: 0.875rem;
    }
    .item-name {
      font-weight: 500;
      min-width: 120px;
    }
    .item-action {
      color: var(--muted);
    }
    .share-section {
      text-align: center;
      padding: 2rem;
    }
    .share-btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .share-btn:hover {
      transform: scale(1.05);
    }
    .copy-feedback {
      color: var(--good);
      margin-top: 1rem;
      display: none;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .stat-number {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .stat-label {
      font-size: 0.75rem;
      color: var(--muted);
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="hero">
    <div class="score-circle" style="border-color: ${scoreColor(radar.overall)}">
      <div class="score-number" style="color: ${scoreColor(radar.overall)}">${radar.overall}</div>
      <div class="score-label" style="color: ${scoreColor(radar.overall)}">${scoreLabel(radar.overall)}</div>
    </div>
    <div class="personality">
      <div class="personality-emoji">${personality.emoji}</div>
      <div class="personality-title">${personality.type} · ${personality.title}</div>
      <div class="personality-desc">${personality.description}</div>
    </div>
  </div>

  <div class="container">
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-number">${skills.length}</div>
        <div class="stat-label">Total Skills</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">~${(health.totalTokenEstimate / 1000).toFixed(1)}K</div>
        <div class="stat-label">Description Token Estimate</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${health.contextWindowPercent}%</div>
        <div class="stat-label">200K Reference Context</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${health.budgetUsedPercent}%</div>
        <div class="stat-label">Local Reference Budget</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📊 Health Radar</div>
      <div class="radar-container">
        ${renderRadarChart(radar.dimensions)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">🏆 Top 10 Longest Descriptions</div>
      ${topConsumers.map(c => `
        <div class="consumer-row">
          <div class="consumer-rank">${c.rank}</div>
          <div class="consumer-name">${escapeHtml(c.name)}</div>
          <div class="consumer-bar">
            <div class="consumer-fill" style="width: ${c.barWidth}%"></div>
          </div>
          <div class="consumer-tokens">${c.tokenCost.toLocaleString()} tokens</div>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <div class="section-title">📋 Review Prompts</div>
      ${prescriptions.map(p => `
        <div class="prescription-card" onclick="this.classList.toggle('expanded')">
          <div class="prescription-header">
            <div class="prescription-emoji">${p.emoji}</div>
            <div class="prescription-title">${p.title}</div>
            <div class="prescription-impact impact-${p.impact}">${p.impact}</div>
          </div>
          <div class="prescription-desc">${p.description}</div>
          <div class="prescription-items">
            ${p.items.map(item => `
              <div class="prescription-item">
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-action">${item.action}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="section share-section">
      <div class="section-title">📤 Share Your Health Report</div>
      <p style="color: var(--muted); margin-bottom: 1.5rem;">Copy to clipboard and share on social media</p>
      <button class="share-btn" onclick="copyReport()">Copy Report to Clipboard</button>
      <div class="copy-feedback" id="copyFeedback">✅ Copied!</div>
    </div>
  </div>

  <script>
    function copyReport() {
      const report = \`🏆 Skill Health Report

Score: ${radar.overall}/100 (${scoreLabel(radar.overall)})
Local Profile: ${personality.emoji} ${personality.type} · ${personality.title}

📊 Stats:
• Total Skills: ${skills.length}
• Description Token Estimate: ~${(health.totalTokenEstimate / 1000).toFixed(1)}K
• 200K Reference Context: ${health.contextWindowPercent}%
• Local Reference Budget: ${health.budgetUsedPercent}%

${personality.description}

Generate your report: npx skill-guide --health --open\`;

      navigator.clipboard.writeText(report).then(() => {
        const feedback = document.getElementById('copyFeedback');
        feedback.style.display = 'block';
        setTimeout(() => feedback.style.display = 'none', 2000);
      });
    }
  </script>
</body>
</html>`;
}

function analyzeSkillPersonality(skills) {
  const total = skills.length;
  const categories = {};
  let totalTokens = 0;
  let securityCount = 0;
  let pluginCount = 0;

  for (const skill of skills) {
    categories[skill.category] = (categories[skill.category] || 0) + 1;
    totalTokens += skill.tokenCost || 0;
    if ((skill.allowedTools || []).length > 0) securityCount++;
    if ((skill.sources || []).some(s => s.includes('plugin'))) pluginCount++;
  }

  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const isZh = lang() === 'zh';

  if (total > 100) {
    return {
      type: isZh ? '收藏家' : 'Collector',
      emoji: '🏛️',
      title: 'The Collector',
      description: isZh
        ? '本地扫描发现了较大的技能库。建议定期复核描述、来源和实际需要。'
        : 'The local scan found a large skill inventory. Review descriptions, sources, and actual needs periodically.',
      advice: isZh ? '建议：定期审视，保留精品。质量 > 数量。' : 'Advice: Review regularly, keep the best. Quality > Quantity.',
    };
  }

  if (total < 10) {
    return {
      type: isZh ? '极简主义者' : 'Minimalist',
      emoji: '🧘',
      title: 'The Minimalist',
      description: isZh
        ? '本地扫描发现了较小的技能库。建议复核它是否覆盖你实际需要的工作。'
        : 'The local scan found a small skill inventory. Review whether it covers the work you actually need.',
      advice: isZh ? '建议：保持精简，但可以探索新领域。' : 'Advice: Stay lean, but explore new domains.',
    };
  }

  if (securityCount > total * 0.3) {
    return {
      type: isZh ? '工具声明较多' : 'Tool-Declared Profile',
      emoji: '🛡️',
      title: 'The Tool-Declared Profile',
      description: isZh
        ? '较多技能声明了可用工具。建议按需复核权限、命令和风险。'
        : 'Many skills declare allowed tools. Review permissions, commands, and risks where needed.',
      advice: isZh ? '建议：按需复核权限和命令。' : 'Advice: Review permissions and commands where needed.',
    };
  }

  if (pluginCount > total * 0.5) {
    return {
      type: isZh ? '插件来源较多' : 'Plugin-Heavy Profile',
      emoji: '🔌',
      title: 'The Plugin-Heavy Profile',
      description: isZh
        ? '本地扫描发现较多插件目录来源。建议关注来源、质量和维护状态。'
        : 'The local scan found many plugin-directory sources. Review provenance, quality, and maintenance status.',
      advice: isZh ? '建议：关注来源、质量和维护状态。' : 'Advice: Review provenance, quality, and maintenance status.',
    };
  }

  if (topCategory && topCategory[1] > total * 0.4) {
    const categoryNames = {
      'coding': { zh: '代码工匠', en: 'Code Craftsman' },
      'testing': { zh: '质量守护者', en: 'Quality Guardian' },
      'devops': { zh: '部署大师', en: 'DevOps Master' },
      'documentation': { zh: '文档专家', en: 'Documentation Expert' },
      'analysis': { zh: '数据分析师', en: 'Data Analyst' },
    };
    const cat = categoryNames[topCategory[0]] || { zh: '领域专家', en: 'Domain Expert' };
    return {
      type: isZh ? cat.zh : cat.en,
      emoji: '🎯',
      title: 'The Specialist',
      description: isZh
        ? `本地元数据集中在 ${topCategory[0]} 类别。建议复核这种分布是否符合实际需要。`
        : `Local metadata is concentrated in the ${topCategory[0]} category. Review whether that distribution matches your needs.`,
      advice: isZh ? '建议：复核类别分布是否符合实际需要。' : 'Advice: Review whether the category distribution matches your needs.',
    };
  }

  return {
    type: isZh ? '覆盖较广' : 'Broad Coverage',
    emoji: '🌟',
    title: 'The All-Rounder',
    description: isZh
      ? '本地扫描显示技能分布覆盖多个类别。建议复核是否存在不再需要的来源。'
      : 'The local scan shows skills across several categories. Review whether any sources are no longer needed.',
    advice: isZh ? '建议：复核来源和类别分布。' : 'Advice: Review sources and category distribution.',
  };
}

function renderTopConsumers(skills, limit = 10) {
  const sorted = [...skills]
    .sort((a, b) => (b.tokenCost || 0) - (a.tokenCost || 0))
    .slice(0, limit);

  const totalTokens = skills.reduce((sum, s) => sum + (s.tokenCost || 0), 0);

  return sorted.map((skill, i) => {
    const percent = totalTokens > 0 ? ((skill.tokenCost || 0) / totalTokens * 100).toFixed(1) : 0;
    const barWidth = Math.min(percent * 2, 100);
    return {
      rank: i + 1,
      name: skill.name,
      tokenCost: skill.tokenCost || 0,
      percent: parseFloat(percent),
      barWidth,
      category: skill.category,
    };
  });
}

function computeRadarScores(skills, health) {
  const isZh = lang() === 'zh';
  const tokenScore = Math.max(0, 100 - health.contextWindowPercent * 2);
  const dupScore = Math.max(0, 100 - health.duplicateGroups.length * 10);
  const secScore = Math.max(0, 100 - health.securityFlags.length * 10); // Changed from 15 to 10
  const freshScore = Math.max(0, 100 - health.staleSkills.length * 5);
  const budgetScore = Math.max(0, 100 - Math.max(0, health.budgetUsedPercent - 100) / 5);

  return {
    dimensions: [
      { name: isZh ? '效率' : 'Efficiency', nameEn: 'Efficiency', score: Math.round(tokenScore) },
      { name: isZh ? '组织' : 'Organize', nameEn: 'Organize', score: Math.round(dupScore) },
      { name: isZh ? '安全' : 'Security', nameEn: 'Security', score: Math.round(secScore) },
      { name: isZh ? '新鲜' : 'Fresh', nameEn: 'Fresh', score: Math.round(freshScore) },
      { name: isZh ? '预算' : 'Budget', nameEn: 'Budget', score: Math.round(budgetScore) },
    ],
    overall: Math.round((tokenScore + dupScore + secScore + freshScore + budgetScore) / 5),
  };
}

function computeWrappedStats(skills, health) {
  const total = skills.length;
  const categories = {};
  for (const skill of skills) {
    categories[skill.category] = (categories[skill.category] || 0) + 1;
  }
  const categoryCount = Object.keys(categories).length;
  const totalTokens = skills.reduce((sum, s) => sum + (s.tokenCost || 0), 0);

  // Category breakdown
  const categoryBreakdown = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100),
    }));

  // Short descriptions are useful review candidates, but do not imply low usage.
  const shortestDescriptions = [...skills]
    .sort((a, b) => (a.tokenCost || 0) - (b.tokenCost || 0))
    .slice(0, 5)
    .map(s => s.name);

  // --- Metadata completeness analysis (description + tools + triggers + tokens) ---
  function computeReadinessScore(skill) {
    let score = 0;
    const descLen = (skill.description || '').length;
    if (descLen > 100) score += 20;
    if (descLen > 200) score += 10;
    if (descLen > 400) score += 10;
    if ((skill.allowedTools || []).length > 0) score += 30;
    if ((skill.triggers || []).length > 0) score += 20;
    const tokens = skill.tokenCost || 0;
    if (tokens > 50) score += 5;
    if (tokens > 100) score += 5;
    return score;
  }

  const scored = skills.map(s => ({ ...s, _readiness: computeReadinessScore(s) }));
  const coreSkills = scored.filter(s => s._readiness >= 50);
  const readySkills = scored.filter(s => s._readiness >= 20 && s._readiness < 50);
  const untappedSkills = scored.filter(s => s._readiness < 20);
  const coreCount = coreSkills.length;
  const readyCount = readySkills.length;
  const untappedCount = untappedSkills.length;
  const corePercent = Math.round((coreCount / total) * 100);
  const readyPercent = Math.round((readyCount / total) * 100);
  const untappedPercent = Math.round((untappedCount / total) * 100);

  // Top categories for display (still useful for archetype)
  const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);

  // --- Local inventory profile ---
  const topCatPercent = sortedCats.length > 0 ? Math.round((sortedCats[0][1] / total) * 100) : 0;
  let archetype;
  if (total <= 3) {
    archetype = { name: 'Small Inventory', emoji: '🌱', tagline: 'A few local skills were detected' };
  } else if (total <= 10) {
    archetype = { name: 'Compact Inventory', emoji: '🔍', tagline: 'A compact set of local skills was detected' };
  } else if (topCatPercent >= 60 && total >= 20) {
    archetype = { name: 'Category-Focused Inventory', emoji: '🎯', tagline: 'Local metadata is concentrated in one category' };
  } else if (total >= 200 && categoryCount >= 7) {
    archetype = { name: 'Large Broad Inventory', emoji: '🏗️', tagline: 'Many local skills span several categories' };
  } else if (total >= 200) {
    archetype = { name: 'Large Inventory', emoji: '⚡', tagline: 'Many local skills were detected' };
  } else if (categoryCount >= 6 && total < 100) {
    archetype = { name: 'Broad Inventory', emoji: '🧭', tagline: 'Local skills span several categories' };
  } else if (total >= 50 && categoryCount <= 4) {
    archetype = { name: 'Focused Inventory', emoji: '🔬', tagline: 'Many local skills are concentrated in a few categories' };
  } else {
    archetype = { name: 'Balanced Inventory', emoji: '⚖️', tagline: 'Local skills are distributed across categories' };
  }

  // Core categories from high-readiness skills
  const coreCatsFromScore = {};
  for (const s of coreSkills) {
    coreCatsFromScore[s.category] = (coreCatsFromScore[s.category] || 0) + 1;
  }
  const coreCats = Object.entries(coreCatsFromScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  if (coreCats.length === 0 && sortedCats.length > 0) {
    coreCats.push(...sortedCats.slice(0, 2).map(([name]) => name));
  }

  return {
    total,
    categoryCount,
    totalTokens,
    categoryBreakdown,
    shortestDescriptions,
    coreCount,
    readyCount,
    untappedCount,
    corePercent,
    readyPercent,
    untappedPercent,
    coreCats,
    archetype,
  };
}

function renderWrappedTerminal(data) {
  const skills = data.skills || [];
  const health = computeHealthStats(skills);
  const personality = analyzeSkillPersonality(skills);
  const wrapped = computeWrappedStats(skills, health);
  const isZh = lang() === 'zh';

  const lines = [
    '╔══════════════════════════════════════════════════════════════╗',
    isZh ? '║              你的 AI 技能报告                              ║'
         : '║              Your AI Skill Report                         ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `${wrapped.archetype.emoji} ${isZh ? '本地技能画像' : 'Local Inventory Profile'}: ${wrapped.archetype.name}`,
    `   ${isZh ? '本地元数据特征：' : 'Local metadata pattern:'} ${wrapped.archetype.tagline}`,
    '',
    isZh ? '── 你的数据 ─────────────────────────────────────────────' : '── Your Stats ─────────────────────────────────────────────',
    `   📦 ${isZh ? '总技能数' : 'Total Skills'}: ${wrapped.total}`,
    `   📂 ${isZh ? '覆盖领域' : 'Categories'}: ${wrapped.categoryCount}`,
    `   🔤 ${isZh ? '描述 Token 估算' : 'Description Token Estimate'}: ~${(wrapped.totalTokens / 1000).toFixed(1)}K`,
    '',
    isZh ? '── 元数据完整度 ───────────────────────────────────────' : '── Metadata Completeness ──────────────────────────────────',
    isZh
      ? `   ⚡ ${wrapped.total} 个技能中，${wrapped.coreCount} 个元数据较完整`
      : `   ⚡ ${wrapped.coreCount} of ${wrapped.total} skills have richer metadata`,
    isZh
      ? `      ${wrapped.readyCount} 个元数据一般 | ${wrapped.untappedCount} 个元数据较少`
      : `      ${wrapped.readyCount} partial metadata | ${wrapped.untappedCount} sparse metadata`,
    isZh
      ? `   🎯 核心领域: ${wrapped.coreCats.join(', ')}`
      : `   🎯 Core domains: ${wrapped.coreCats.join(', ')}`,
    '',
  ];

  // Category breakdown
  lines.push(isZh ? '── 技能 DNA ─────────────────────────────────────────────' : '── Skill DNA ─────────────────────────────────────────────');
  for (const cat of wrapped.categoryBreakdown.slice(0, 6)) {
    const bar = '█'.repeat(Math.max(1, Math.round(cat.percent / 5)));
    lines.push(`   ${cat.name.padEnd(15)} ${bar} ${cat.count} (${cat.percent}%)`);
  }
  lines.push('');

  // Local review candidates
  lines.push(isZh ? '── 本地复核提示 ─────────────────────────────────────────' : '── Local Review Notes ─────────────────────────────────────');
  if (wrapped.shortestDescriptions.length > 0) {
    lines.push(isZh
      ? `   🔍 描述最短的技能: ${wrapped.shortestDescriptions[0]}`
      : `   🔍 Shortest skill description: ${wrapped.shortestDescriptions[0]}`);
  }
  lines.push(isZh
    ? '   📍 以上结论仅基于本地扫描结果，不代表社区排名或实际使用频率'
    : '   📍 These notes use local scan data only; they are not community rankings or usage metrics');
  lines.push('');

  // CTA with suspense-driven share text
  lines.push(isZh ? '── 分享你的报告 ─────────────────────────────────────────' : '── Share Your Report ──────────────────────────────────────');
  const shareHint = isZh
    ? `   📤 "${wrapped.archetype.name} — 本地扫描到 ${wrapped.total} 个技能，其中 ${wrapped.untappedCount} 个元数据较少。"`
    : `   📤 "${wrapped.archetype.name} — ${wrapped.total} local skills scanned, including ${wrapped.untappedCount} with sparse metadata."`;
  lines.push(shareHint);
  lines.push(isZh
    ? '   🔗 使用 --open 生成可分享的 HTML 报告'
    : '   🔗 Use --open to generate a shareable HTML report');
  lines.push('');

  return lines.join('\n');
}

function renderWrappedHTML(data) {
  const skills = data.skills || [];
  const health = computeHealthStats(skills);
  const personality = analyzeSkillPersonality(skills);
  const radar = computeRadarScores(skills, health);
  const wrapped = computeWrappedStats(skills, health);
  const isZh = lang() === 'zh';

  function renderRadarChart(dimensions) {
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const levels = 5;

    function pentagonPoints(r) {
      return Array.from({ length: 5 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
      }).join(' ');
    }

    const dataPoints = dimensions.map((d, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const r = (d.score / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');

    const labels = dimensions.map((d, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const labelR = radius + 25;
      const x = center + labelR * Math.cos(angle);
      const y = center + labelR * Math.sin(angle);
      const anchor = i === 0 ? 'middle' : i < 3 ? 'start' : 'end';
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#94a3b8" font-size="11">${d.name}</text>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${size} ${size}" class="radar-chart">
        ${Array.from({ length: levels }, (_, i) => {
          const r = (radius / levels) * (i + 1);
          return `<polygon points="${pentagonPoints(r)}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
        }).join('')}
        <polygon points="${dataPoints}" fill="rgba(124,58,237,0.3)" stroke="#7c3aed" stroke-width="2"/>
        ${labels}
      </svg>
    `;
  }

  const categoryBars = wrapped.categoryBreakdown.slice(0, 6).map(cat => {
    const barWidth = Math.max(2, cat.percent);
    const colors = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
    const color = colors[wrapped.categoryBreakdown.indexOf(cat) % colors.length];
    return `
      <div class="dna-row">
        <span class="dna-name">${escapeHtml(cat.name)}</span>
        <div class="dna-bar"><div class="dna-fill" style="width:${barWidth}%;background:${color}"></div></div>
        <span class="dna-count">${cat.count} (${cat.percent}%)</span>
      </div>`;
  }).join('');

  const shareText = isZh
    ? `${wrapped.archetype.emoji} ${wrapped.archetype.name} — 本地扫描到 ${wrapped.total} 个技能，其中 ${wrapped.untappedCount} 个元数据较少。`
    : `${wrapped.archetype.emoji} ${wrapped.archetype.name} — ${wrapped.total} local skills scanned, including ${wrapped.untappedCount} with sparse metadata.`;

  return `<!DOCTYPE html>
<html lang="${lang()}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isZh ? '我的 AI 技能报告' : 'My AI Skill Report'} — skill-guide</title>
  <meta property="og:title" content="${isZh ? '我的 AI 技能报告' : 'My AI Skill Report'} — skill-guide">
  <meta property="og:description" content="${escapeHtml(shareText)}">
  <style>
    :root {
      --bg: #0f0f23;
      --card: #1a1a2e;
      --text: #e0e0e0;
      --muted: #888;
      --accent: #7c3aed;
      --accent2: #06b6d4;
      --good: #10b981;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .hero {
      text-align: center;
      padding: 4rem 2rem;
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #0c1222 100%);
    }
    .hero-emoji { font-size: 4rem; margin-bottom: 1rem; }
    .hero-title {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .hero-subtitle { color: var(--muted); font-size: 1.1rem; max-width: 600px; margin: 0 auto; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
    .section {
      background: var(--card);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 1.25rem;
      text-align: center;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label { color: var(--muted); font-size: 0.85rem; margin-top: 0.25rem; }
    .compare-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .compare-label { width: 140px; font-weight: 500; }
    .compare-bar-wrap { flex: 1; }
    .compare-bar {
      height: 10px;
      background: rgba(255,255,255,0.1);
      border-radius: 5px;
      overflow: hidden;
      position: relative;
    }
    .compare-fill {
      height: 100%;
      border-radius: 5px;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
    }
    .compare-value { width: 80px; text-align: right; font-weight: 600; color: var(--accent); }
    .dna-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }
    .dna-name { width: 120px; font-size: 0.9rem; color: var(--muted); }
    .dna-bar { flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; }
    .dna-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
    .dna-count { width: 80px; text-align: right; font-size: 0.85rem; color: var(--muted); }
    .radar-container { display: flex; justify-content: center; padding: 1rem; }
    .radar-chart { width: min(280px, 80vw); height: min(280px, 80vw); }
    .share-section {
      text-align: center;
      padding: 2rem;
      background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.1));
      border-radius: 16px;
      margin-top: 2rem;
    }
    .share-btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      font-size: 1rem;
      cursor: pointer;
      border: none;
      margin: 0.5rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .share-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
    .share-btn.primary { background: linear-gradient(135deg, #7c3aed, #06b6d4); color: #fff; }
    .share-btn.secondary { background: rgba(255,255,255,0.1); color: var(--text); }
    .share-text {
      background: var(--card);
      border-radius: 12px;
      padding: 1.5rem;
      margin: 1rem auto;
      max-width: 600px;
      text-align: left;
      font-size: 0.95rem;
      line-height: 1.6;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .cta {
      text-align: center;
      padding: 2rem;
      margin-top: 2rem;
    }
    .cta code {
      background: var(--card);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 1.1rem;
      display: inline-block;
      margin: 0.5rem 0;
    }
    .footer {
      text-align: center;
      padding: 2rem;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .gap-visual {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      margin: 1.5rem 0;
    }
    .gap-core, .gap-ready, .gap-untapped {
      text-align: center;
      flex: 1;
      padding: 1.25rem;
      border-radius: 12px;
    }
    .gap-core {
      background: rgba(124,58,237,0.1);
      border: 1px solid rgba(124,58,237,0.2);
    }
    .gap-ready {
      background: rgba(6,182,212,0.08);
      border: 1px solid rgba(6,182,212,0.15);
    }
    .gap-untapped {
      background: rgba(245,158,11,0.08);
      border: 1px solid rgba(245,158,11,0.15);
    }
    .gap-number {
      font-size: 2.5rem;
      font-weight: 800;
    }
    .gap-core .gap-number { color: var(--accent); }
    .gap-ready .gap-number { color: var(--accent2); }
    .gap-untapped .gap-number { color: #f59e0b; }
    .gap-label { font-weight: 600; margin-top: 0.25rem; }
    .gap-detail { color: var(--muted); font-size: 0.85rem; margin-top: 0.5rem; }
    .gap-divider { display: flex; align-items: center; }
    .gap-vs {
      background: rgba(255,255,255,0.1);
      color: var(--muted);
      font-weight: 700;
      font-size: 0.85rem;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gap-bar-wrap {
      display: flex;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 1rem;
    }
    .gap-bar-core { background: var(--accent); }
    .gap-bar-ready { background: var(--accent2); }
    .gap-bar-untapped { background: #f59e0b; }
    .gap-bar-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 0.4rem;
    }
    @media (max-width: 600px) {
      .hero-title { font-size: 1.8rem; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .gap-visual { flex-direction: column; gap: 1rem; }
      .gap-divider { transform: rotate(90deg); }
    }
  </style>
</head>
<body>
  <div class="hero">
    <div class="hero-emoji">${wrapped.archetype.emoji}</div>
    <h1 class="hero-title">${isZh ? wrapped.archetype.name : wrapped.archetype.name}</h1>
    <p class="hero-subtitle">${escapeHtml(wrapped.archetype.tagline)}</p>
  </div>

  <div class="container">
    <div class="section">
      <h2 class="section-title">${isZh ? '📊 你的数据' : '📊 Your Stats'}</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${wrapped.total}</div>
          <div class="stat-label">${isZh ? '总技能数' : 'Total Skills'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${wrapped.categoryCount}</div>
          <div class="stat-label">${isZh ? '覆盖领域' : 'Categories'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${(wrapped.totalTokens / 1000).toFixed(1)}K</div>
          <div class="stat-label">${isZh ? '描述 Token 估算' : 'Description Token Estimate'}</div>
        </div>
      </div>
    </div>

    <div class="section" style="background:linear-gradient(135deg, rgba(245,158,11,0.08), rgba(124,58,237,0.08));border:1px solid rgba(245,158,11,0.15)">
      <h2 class="section-title">${isZh ? '⚡ 元数据完整度' : '⚡ Metadata Completeness'}</h2>
      <p style="color:var(--muted);margin-bottom:1rem;font-size:0.9rem">
        ${isZh ? '基于描述完整度、工具配置和触发词' : 'Based on description depth, tool config, and triggers'}
      </p>
      <div class="gap-visual">
        <div class="gap-core">
          <div class="gap-number">${wrapped.coreCount}</div>
          <div class="gap-label">${isZh ? '元数据较完整' : 'Richer Metadata'}</div>
          <div class="gap-detail">${isZh ? '描述、工具或触发词较完整' : 'More description, tool, or trigger metadata'}</div>
        </div>
        <div class="gap-divider"><div class="gap-vs">+</div></div>
        <div class="gap-ready">
          <div class="gap-number">${wrapped.readyCount}</div>
          <div class="gap-label">${isZh ? '元数据一般' : 'Partial Metadata'}</div>
          <div class="gap-detail">${isZh ? '可以按需补充' : 'Review whether more detail is useful'}</div>
        </div>
        <div class="gap-divider"><div class="gap-vs">+</div></div>
        <div class="gap-untapped">
          <div class="gap-number">${wrapped.untappedCount}</div>
          <div class="gap-label">${isZh ? '元数据较少' : 'Sparse Metadata'}</div>
          <div class="gap-detail">${isZh ? '建议复核描述和触发词' : 'Review descriptions and triggers'}</div>
        </div>
      </div>
      <div class="gap-bar-wrap">
        <div class="gap-bar-core" style="width:${wrapped.corePercent}%"></div>
        <div class="gap-bar-ready" style="width:${wrapped.readyPercent}%"></div>
        <div class="gap-bar-untapped" style="width:${wrapped.untappedPercent}%"></div>
      </div>
      <div class="gap-bar-labels">
        <span>${wrapped.corePercent}% ${isZh ? '较完整' : 'richer'}</span>
        <span>${wrapped.readyPercent}% ${isZh ? '一般' : 'partial'}</span>
        <span>${wrapped.untappedPercent}% ${isZh ? '较少' : 'sparse'}</span>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">${isZh ? '📍 本地画像说明' : '📍 Local Profile Notes'}</h2>
      <p style="color:var(--muted);font-size:0.9rem">
        ${isZh
          ? '此报告只使用当前设备扫描到的技能元数据。它不会推断社区排名、实际使用频率或删除安全性。'
          : 'This report uses skill metadata scanned on this device only. It does not infer community rank, actual usage, or whether deletion is safe.'}
      </p>
    </div>

    <div class="section">
      <h2 class="section-title">${isZh ? '🧬 技能 DNA' : '🧬 Skill DNA'}</h2>
      ${categoryBars}
    </div>

    <div class="section">
      <h2 class="section-title">${isZh ? '📈 五维健康雷达' : '📈 Health Radar'}</h2>
      <div class="radar-container">
        ${renderRadarChart(radar.dimensions)}
      </div>
    </div>

    <div class="share-section">
      <h2>${isZh ? '📤 分享你的报告' : '📤 Share Your Report'}</h2>
      <p style="color:var(--muted);margin:0.5rem 0">${isZh ? '让朋友也看看自己的技能 DNA' : 'Let friends discover their skill DNA'}</p>
      <div class="share-text">${escapeHtml(shareText)}</div>
      <button class="share-btn primary" onclick="copyShare()">${isZh ? '复制分享文案' : 'Copy Share Text'}</button>
      <button class="share-btn secondary" onclick="copyLink()">${isZh ? '复制命令' : 'Copy Command'}</button>
    </div>

    <div class="cta">
      <p style="color:var(--muted);margin-bottom:0.5rem">${isZh ? '生成你自己的技能报告' : 'Generate your own skill report'}</p>
      <code>npx skill-guide --wrapped --open</code>
    </div>
  </div>

  <div class="footer">
    <p>Powered by <a href="https://github.com/gtskevin/skill-guide" style="color:var(--accent)">skill-guide</a></p>
  </div>

  <script>
    function copyShare() {
      navigator.clipboard.writeText(${JSON.stringify(shareText + '\n\nnpx skill-guide --wrapped --open')}).then(() => {
        alert('${isZh ? '已复制到剪贴板！' : 'Copied to clipboard!'}');
      });
    }
    function copyLink() {
      navigator.clipboard.writeText('npx skill-guide --wrapped --open').then(() => {
        alert('${isZh ? '已复制到剪贴板！' : 'Copied to clipboard!'}');
      });
    }
  </script>
</body>
</html>`;
}

function generatePrescription(skills, health) {
  const prescriptions = [];
  const totalTokens = skills.reduce((sum, s) => sum + (s.tokenCost || 0), 0);

  const topConsumers = [...skills]
    .sort((a, b) => (b.tokenCost || 0) - (a.tokenCost || 0))
    .slice(0, 5);

  if (topConsumers.length > 0) {
    const topTokens = topConsumers.reduce((sum, s) => sum + (s.tokenCost || 0), 0);
    const percent = totalTokens > 0 ? (topTokens / totalTokens * 100).toFixed(0) : 0;
    const isSignificant = parseInt(percent) >= 10;

    prescriptions.push({
      type: 'optimize',
      emoji: isSignificant ? '🎯' : '💡',
      title: isSignificant ? '描述复核' : '优化建议',
      titleEn: isSignificant ? 'Description Review' : 'Optimization Tips',
      description: isSignificant
        ? `这 ${topConsumers.length} 个技能占描述 Token 估算的 ${percent}%，建议复核是否需要精简`
        : `你的技能库很均衡，没有明显的瘦身空间。Top ${topConsumers.length} 只占 ${percent}%`,
      descriptionEn: isSignificant
        ? `These ${topConsumers.length} skills account for ${percent}% of estimated description tokens; review whether their descriptions should be shortened`
        : `Your skill library is well-balanced. Top ${topConsumers.length} only account for ${percent}%`,
      items: topConsumers.map(s => ({
        name: s.name,
        tokens: s.tokenCost,
        action: isSignificant ? '复核并按需精简描述' : '保持现状',
        actionEn: isSignificant ? 'Review and shorten the description if appropriate' : 'Keep as is',
      })),
      impact: isSignificant ? 'high' : 'low',
    });
  }

  if (health.securityFlags.length > 0) {
    prescriptions.push({
      type: 'security',
      emoji: '🛡️',
      title: '安全审查',
      titleEn: 'Security Review',
      description: `${health.securityFlags.length} 个技能有安全风险标记，建议人工审查`,
      descriptionEn: `${health.securityFlags.length} skills have security flags, recommend manual review`,
      items: health.securityFlags.slice(0, 5).map(s => ({
        name: s.name,
        flags: s.flags,
        action: '审查权限和命令',
        actionEn: 'Review permissions and commands',
      })),
      impact: 'medium',
    });
  }

  if (health.duplicateGroups.length > 0) {
    prescriptions.push({
      type: 'dedup',
      emoji: '🔄',
      title: '去重优化',
      titleEn: 'Deduplication',
      description: `发现 ${health.duplicateGroups.length} 组同名技能，请复核来源和自定义改动`,
      descriptionEn: `Found ${health.duplicateGroups.length} same-name groups; review sources and custom changes`,
      items: health.duplicateGroups.slice(0, 3).map(g => ({
        name: g.names.join(' = '),
        action: '复核来源后再决定是否处理',
        actionEn: 'Review sources before deciding what to change',
      })),
      impact: 'low',
    });
  }

  if (health.budgetUsedPercent > 100) {
    const overAmount = health.totalDescriptionLength - health.descriptionBudget;
    prescriptions.push({
      type: 'budget',
      emoji: '📦',
      title: '预算超支',
      titleEn: 'Budget Overage',
      description: `描述总长度超出本地参考预算 ${overAmount.toLocaleString()} 字符，建议复核较长描述`,
      descriptionEn: `Total description length exceeds the local reference budget by ${overAmount.toLocaleString()} chars; review longer descriptions`,
      items: [{
        name: '整体',
        action: '精简技能描述，删除不必要的细节',
        actionEn: 'Shorten skill descriptions, remove unnecessary details',
      }],
      impact: 'high',
    });
  }

  return prescriptions;
}

function main() {
  const mode = parseMode();
  if (mode.mode === 'help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  // --doctor: terminal-only diagnostic
  if (mode.mode === 'doctor') {
    const data = runScanner(mode);
    applyPlatformFilter(data);
    process.stdout.write(`${printDoctor(data)}\n`);
    return;
  }

  const format = getArgValue('--format') || 'html';

  // --find mode: try skill deep-dive, fall back to search
  if (mode.mode === 'find') {
    const skillData = runScanner(mode);
    if (skillData.error) {
      // Skill not found — fall back to search
      mode.mode = 'search';
      const searchArgs = ['--search', mode.value];
      if (hasFlag('--refresh')) searchArgs.push('--refresh');
      const result = spawnSync(process.execPath, [SCANNER, ...searchArgs], {
        cwd: process.cwd(), encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (result.status !== 0) {
        process.stderr.write(result.stderr || '');
        process.exit(result.status || 1);
      }
      const data = JSON.parse(result.stdout);
      applyPlatformFilter(data);
      if (format === 'json') {
        process.stdout.write(JSON.stringify(data, null, 2) + '\n');
        return;
      }
      process.stdout.write(renderDefaultTerminal(data.skills || []));
      const output = path.resolve(getArgValue('--output') || defaultOutputPath(mode));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, renderHtml(data, mode), 'utf8');
      if (shouldAutoOpen()) openFile(output);
      process.stdout.write(`Generated ${output}\n`);
    } else {
      // Skill found — deep dive
      mode.mode = 'skill';
      applyPlatformFilter(skillData);
      if (format === 'json') {
        process.stdout.write(JSON.stringify(skillData, null, 2) + '\n');
        return;
      }
      const output = path.resolve(getArgValue('--output') || defaultOutputPath(mode));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, renderHtml(skillData, mode), 'utf8');
      if (shouldAutoOpen()) openFile(output);
      process.stdout.write(`Generated ${output}\n`);
    }
    return;
  }

  // --review mode (JSON-only for agent programmatic consumption)
  if (mode.mode === 'review') {
    const data = runScanner(mode);
    applyPlatformFilter(data);
    const details = doctorDetails(data);
    const brief = buildReviewBrief(data, details);
    brief.copyPrompt = buildCopyPrompt(brief);
    process.stdout.write(JSON.stringify(brief, null, 2) + '\n');
    return;
  }

  // --check mode: Review Readiness checks
  if (mode.mode === 'check') {
    let results;
    if (mode.value) {
      const targetPath = path.resolve(mode.value);
      if (!fs.existsSync(targetPath)) {
        process.stderr.write(`File not found: ${targetPath}\n`);
        process.exit(1);
      }
      results = [lintSkillFile(targetPath)];
    } else {
      const data = runScanner(mode);
      applyPlatformFilter(data);
      results = lintAllSkills(data);
    }
    if (format === 'json') {
      process.stdout.write(JSON.stringify(renderLintJSON(results), null, 2) + '\n');
      return;
    }
    process.stdout.write(renderLintTerminal(results) + '\n');
    return;
  }

  // --overlap mode: detect skill overlaps
  if (mode.mode === 'overlap') {
    const data = runScanner(mode);
    applyPlatformFilter(data);
    const overlaps = detectOverlaps(data.skills || []);
    if (format === 'json') {
      process.stdout.write(JSON.stringify(renderOverlapJSON(overlaps), null, 2) + '\n');
      return;
    }
    process.stdout.write(renderOverlapTerminal(overlaps) + '\n');
    return;
  }

  // --recommend mode (online registry data)
  if (mode.mode === 'recommend') {
    const data = runScanner(mode);
    applyPlatformFilter(data);
    const installed = data.skills;
    const refresh = hasFlag('--refresh');
    const onlineEntries = registryModule.fetchRegistry({ refresh });
    const recommendations = registryModule.recommend(installed, onlineEntries);
    if (format === 'json') {
      process.stdout.write(JSON.stringify({ installed, recommendations }, null, 2) + '\n');
      return;
    }
    process.stdout.write(renderRecommendTerminal(data, recommendations));
    const outputFile = getArgValue('--output');
    const html = renderRecommendHTML(data, recommendations, getArgValue('--user'));
    const defaultFile = path.join(os.tmpdir(), 'skill-guide-recommend.html');
    const targetFile = outputFile ? path.resolve(outputFile) : defaultFile;
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, html, 'utf8');
    if (shouldAutoOpen()) openFile(targetFile);
    process.stdout.write(`Generated: ${targetFile}\n`);
    return;
  }

  // --share mode (portfolio with --user flag)
  if (mode.mode === 'share') {
    const data = runScanner(mode);
    applyPlatformFilter(data);
    const user = getArgValue('--user');
    if (format === 'json') {
      process.stdout.write(JSON.stringify({ skills: data.skills, totalCount: data.totalCount }, null, 2) + '\n');
      return;
    }
    const outputFile = getArgValue('--output');
    const html = renderShareHTML(data, user);
    const defaultFile = path.join(os.tmpdir(), 'skill-guide-share.html');
    const targetFile = outputFile ? path.resolve(outputFile) : defaultFile;
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, html, 'utf8');
    if (shouldAutoOpen()) openFile(targetFile);
    process.stdout.write(`Generated: ${targetFile}\n`);
    return;
  }

  // Default mode (list): overview dashboard
  const data = runScanner(mode);
  applyPlatformFilter(data);

  if (format === 'json') {
    const serialized = JSON.stringify(data, null, 2);
    const jsonOutput = getArgValue('--output');
    if (jsonOutput) {
      const outputPath = path.resolve(jsonOutput);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${serialized}\n`, 'utf8');
      process.stdout.write(`Generated ${outputPath}\n`);
    } else {
      process.stdout.write(`${serialized}\n`);
    }
    return;
  }

  if (data.error) {
    process.stderr.write(`${formatScannerError(data)}\n`);
    process.exit(1);
  }

  if (data._platform && data._platform !== 'all') {
    process.stdout.write(`  Showing: ${platformLabel()} (use --all to see all)\n\n`);
  }
  process.stdout.write(renderDefaultTerminal(data.skills || []));

  const output = path.resolve(getArgValue('--output') || defaultOutputPath(mode));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, renderHtml(data, mode), 'utf8');

  if (shouldAutoOpen()) openFile(output);
  process.stdout.write(`Generated ${output}\n`);
}

main();
