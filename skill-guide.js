#!/usr/bin/env node
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const SCANNER = path.join(ROOT, 'scan-skills.js');
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
    '  skill-guide [--open] [--output <file>] [--format html|json] [--lang en|zh] [--refresh]',
    '  skill-guide --search <query> [--open] [--output <file>] [--format html|json] [--lang en|zh]',
    '  skill-guide --skill <name> [--open] [--output <file>] [--format html|json] [--lang en|zh]',
    '  skill-guide --full [--open] [--output <file>] [--format html|json] [--lang en|zh]',
    '  skill-guide --recommend [--open] [--output <file>] [--format html|json] [--lang en|zh] [--refresh]',
    '  skill-guide --share [--open] [--output <file>] [--lang en|zh] [--user <name>]',
    '  skill-guide --doctor [--refresh]',
    '',
    'Examples:',
    '  npx skill-guide --open',
    '  npx skill-guide --search security --open',
    '  npx skill-guide --skill tdd --lang zh --open',
    '  npx skill-guide --recommend --open',
    '  npx skill-guide --doctor',
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
    overlapAlert: 'Overlap Alert',
    skillsInCategory: 'You have {count} skills in "{category}" category',
    considerKeeping: 'Consider keeping only the most-used one',
    popularYoureMissing: 'Popular Skills You\'re Missing',
    categoriesCovered: 'categories covered',
    myAiSkillStack: 'My AI Skill Stack',
    sharedBy: 'Shared by {user}',
    poweredBy: 'Powered by skill-guide',
    installSkillGuide: 'Install skill-guide to discover your skills',
    topPicks: 'Top Picks',
    nMore: '+ {count} more',
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
    overlapAlert: '重叠检测',
    skillsInCategory: '你在 "{category}" 分类下有 {count} 个技能',
    considerKeeping: '建议只保留最常用的',
    popularYoureMissing: '你还没装的热门技能',
    categoriesCovered: '个分类已覆盖',
    myAiSkillStack: '我的 AI 技能栈',
    sharedBy: '由 {user} 分享',
    poweredBy: '由 skill-guide 驱动',
    installSkillGuide: '安装 skill-guide 来发现你的技能',
    topPicks: '精选推荐',
    nMore: '+ {count} 更多',
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
  if (hasFlag('--recommend')) return { mode: 'recommend' };
  if (hasFlag('--share')) return { mode: 'share' };
  if (hasFlag('--full') || args[0] === 'all') return { mode: 'full' };

  const skill = getArgValue('--skill');
  if (skill) return { mode: 'skill', value: skill };

  const search = getArgValue('--search');
  if (search) return { mode: 'search', value: search };

  const valueFlags = new Set(['--output', '--skill', '--search', '--format', '--lang']);
  const positional = args.find((arg, index) => !arg.startsWith('-') && !valueFlags.has(args[index - 1]));
  if (positional) return { mode: 'skill', value: positional };

  return { mode: 'list' };
}

function scannerArgsFor(mode) {
  const scannerArgs = [];
  if (hasFlag('--refresh')) scannerArgs.push('--refresh');

  if (mode.mode === 'list' || mode.mode === 'doctor') {
    scannerArgs.push('--list');
  } else if (mode.mode === 'skill') {
    scannerArgs.push('--skill', mode.value);
  } else if (mode.mode === 'search') {
    scannerArgs.push('--search', mode.value);
  } else if (mode.mode === 'full' || mode.mode === 'recommend' || mode.mode === 'share') {
    scannerArgs.push('--full');
  }

  return scannerArgs;
}

function runScanner(mode) {
  const args = scannerArgsFor(mode);
  if (mode.mode === 'full' || mode.mode === 'recommend' || mode.mode === 'share') {
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

  return `<section class="slide cover">
    <div class="rv center">
      <div class="kicker" data-i18n="label">${escapeHtml(modeLabel)}</div>
      <h1><span class="grad" data-i18n="label">${escapeHtml(title)}</span></h1>
      <p class="sub">${escapeHtml(data.totalCount || 0)} ${t('skillsScanned')} · ${escapeHtml(subtitle)}</p>
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
  const highlights = [...skills]
    .sort((a, b) => ((b.triggers || []).length + (b.sources || []).length) - ((a.triggers || []).length + (a.sources || []).length))
    .slice(0, 8);

  return `<section class="slide">
    <div class="rv wide">
      <h2 data-i18n="label">${t('highlights')}</h2>
      <div class="list">${highlights.map((skill, index) => `<article class="row">
        <strong>${index + 1}</strong>
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <p data-i18n="desc">${te(truncate(skill.description, 180))}</p>
          <div>${categoryBadge(skill.category)}${sourceBadges(skill.sources)}</div>
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

function renderSlides(data, mode) {
  if (data.error) {
    return `${renderCover(data, mode)}<section class="slide"><div class="rv center"><h2>Error</h2><p class="sub">${escapeHtml(data.error)}</p></div></section>`;
  }

  if (mode.mode === 'search') return `${renderCover(data, mode)}${renderSelection(data, mode)}`;
  if (mode.mode === 'skill') return `${renderCover(data, mode)}${renderSkillDetails(data.skills)}`;
  if (mode.mode === 'full') return `${renderCover(data, mode)}${renderCategorySlide(data.skills)}${renderSkillDetails(data.skills)}${renderReference(data.skills, t('completeReference'))}`;
  return `${renderCover(data, mode)}${renderCategorySlide(data.skills)}${renderHighlights(data.skills)}${renderReference(data.skills)}`;
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

  lines.push('');
  lines.push('┌─ skill-guide recommend ─────────────────────┐');
  lines.push('│                                              │');
  lines.push(`│  ${t('yourSkillStack')}: ${data.totalCount} skills, ${totalCategories}/9 ${t('categoriesCovered')}`);
  lines.push('│                                              │');

  const gaps = recommendations.filter((r) => r.type === 'gap');
  if (gaps.length > 0) {
    lines.push(`│  ⚠️  ${t('gapAnalysis')} (${gaps.length}):`);
    for (const gap of gaps) {
      lines.push(`│    • ${gap.category} — 0 skills`);
      if (gap.skills.length > 0) {
        lines.push(`│      → ${t('tryThese')}: ${gap.skills.map((s) => s.name).join(', ')}`);
      }
      if (gap.action) lines.push(`│    💡 ${gap.action}`);
    }
    lines.push('│');
  }

  const popular = recommendations.filter((r) => r.type === 'popular');
  if (popular.length > 0) {
    lines.push(`│  🔥 ${t('popularYoureMissing')}:`);
    for (const skill of popular.slice(0, 5)) {
      lines.push(`│    • ${skill.name} (${skill.message})`);
    }
    lines.push('│');
  }

  const overlaps = recommendations.filter((r) => r.type === 'overlap');
  if (overlaps.length > 0) {
    lines.push(`│  📋 ${t('overlapAlert')}:`);
    for (const overlap of overlaps) {
      lines.push(`│    • ${t('skillsInCategory').replace('{count}', overlap.count).replace('{category}', overlap.category)}`);
      lines.push(`│      ${t('considerKeeping')}`);
      if (overlap.hasMore) lines.push(`│    ... +${overlap.remainingCount} more`);
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

  const popularItems = popular.slice(0, 10).map((skill) => `
    <article class="card popular-card">
      <h3>${escapeHtml(skill.name)}</h3>
      <p>${escapeHtml(skill.description || '')}</p>
      <p class="meta">${escapeHtml(skill.message)}</p>
      ${skill.url ? `<a href="${escapeHtml(skill.url)}" class="link">GitHub →</a>` : ''}
    </article>
  `).join('');

  const overlapItems = overlaps.map((overlap) => `
    <article class="card overlap-card">
      <h3>${escapeHtml(overlap.category)}</h3>
      <p>${escapeHtml(t('skillsInCategory').replace('{count}', overlap.count).replace('{category}', overlap.category))}</p>
      <p class="meta">${t('considerKeeping')}</p>
      <div class="chips">${overlap.skills.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}${
        overlap.hasMore ? `<span class="chip-more">${escapeHtml(t('nMore').replace('{count}', overlap.remainingCount))}</span>` : ''
      }</div>
    </article>
  `).join('');

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
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
  .card{background:var(--card);padding:1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.05)}
  .card h3{margin-bottom:0.5rem;font-size:1.1rem}
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
  .cta{text-align:center;margin:3rem 0;padding:2rem;background:linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.1));border-radius:16px}
  .cta h2{margin:0 0 0.5rem}
  .cta code{background:var(--card);padding:0.5rem 1rem;border-radius:8px;font-size:1.1rem;display:inline-block;margin:0.5rem 0}
  .cta a{color:var(--accent);text-decoration:none}
  .user-tag{color:var(--muted);font-size:0.9rem;margin-bottom:1rem}
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

  ${gaps.length > 0 ? `<h2>⚠️ ${escapeHtml(t('gapAnalysis'))}</h2><div class="grid">${gapCards}</div>` : ''}
  ${popular.length > 0 ? `<h2>🔥 ${escapeHtml(t('popularYoureMissing'))}</h2><div class="grid">${popularItems}</div>` : ''}
  ${overlaps.length > 0 ? `<h2>📋 ${escapeHtml(t('overlapAlert'))}</h2><div class="grid">${overlapItems}</div>` : ''}

  <div class="cta">
    <h2>${escapeHtml(t('poweredBy'))}</h2>
    <p>${escapeHtml(t('installSkillGuide'))}</p>
    <code>npx skill-guide --open</code>
    <p><a href="https://github.com/gtskevin/skill-guide">github.com/gtskevin/skill-guide</a></p>
  </div>
</div>
</body>
</html>`;
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

function renderShareHTML(data, user) {
  const groups = groupBy(data.skills, 'category');
  const totalCategories = Object.keys(groups).length;
  const persona = generatePersona(data.skills);

  const radarChart = renderRadarChart(data.skills);

  const topPicks = data.skills
    .filter((s) => s.whenToUse || s.howItWorks || (s.sections && s.sections.length > 0))
    .slice(0, 5);

  const categoryCards = Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, items]) => `
      <article class="card">
        <h3>${escapeHtml(category)} <span class="count">${items.length}</span></h3>
        <div class="skill-list">${items.map((s) => `
          <div class="skill-item">
            <span class="skill-name">${escapeHtml(s.name)}</span>
            <span class="skill-desc">${escapeHtml(truncate(s.description || '', 80))}</span>
          </div>
        `).join('')}</div>
      </article>
    `).join('');

  const topPicksSection = topPicks.length > 0 ? `
    <h2>${escapeHtml(t('topPicks'))}</h2>
    <div class="grid picks">${topPicks.map((s) => `
      <article class="card pick-card">
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(truncate(s.description || '', 120))}</p>
      </article>
    `).join('')}</div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t('myAiSkillStack'))} — skill-guide</title>
<meta property="og:title" content="${escapeHtml(t('myAiSkillStack'))}">
<meta property="og:description" content="${data.totalCount} skills across ${totalCategories} categories — powered by skill-guide">
<meta property="og:type" content="website">
<style>
  :root{--bg:#0f0f23;--card:#1a1a2e;--text:#e0e0e0;--muted:#888;--accent:#7c3aed;--accent2:#06b6d4;--pick:#10b981}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;padding:2rem}
  .container{max-width:960px;margin:0 auto}
  .hero{text-align:center;padding:3rem 0}
  h1{font-size:3rem;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem}
  h2{font-size:1.5rem;margin:2.5rem 0 1rem;color:var(--accent2)}
  .subtitle{color:var(--muted);font-size:1.1rem}
  .persona{font-size:1.3rem;color:var(--accent);font-weight:600;margin:0.5rem 0;letter-spacing:0.05em}
  .user-tag{color:var(--muted);font-size:0.9rem;margin-bottom:0.5rem}
  .stats{display:flex;gap:1.5rem;justify-content:center;margin:1.5rem 0}
  .stat{background:var(--card);padding:1rem 2rem;border-radius:12px;text-align:center;min-width:120px}
  .stat b{font-size:2.5rem;display:block;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .stat span{color:var(--muted);font-size:0.85rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
  .picks{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
  .card{background:var(--card);padding:1.5rem;border-radius:12px;border:1px solid rgba(255,255,255,0.05)}
  .card h3{margin-bottom:0.75rem;font-size:1.1rem;display:flex;align-items:center;gap:0.5rem}
  .card .count{background:rgba(124,58,237,0.2);padding:0.15rem 0.5rem;border-radius:999px;font-size:0.8rem;color:var(--accent)}
  .pick-card{border-left:3px solid var(--pick)}
  .pick-card p{color:var(--muted);font-size:0.9rem}
  .skill-list{display:flex;flex-direction:column;gap:0.4rem}
  .skill-item{display:flex;gap:0.5rem;align-items:baseline}
  .skill-name{font-weight:600;font-size:0.95rem;white-space:nowrap}
  .skill-desc{color:var(--muted);font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cta{text-align:center;margin:3rem 0;padding:2.5rem;background:linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.1));border-radius:16px}
  .cta h2{margin:0 0 0.5rem}
  .cta p{color:var(--muted);margin:0.5rem 0}
  .cta code{background:var(--card);padding:0.5rem 1.5rem;border-radius:8px;font-size:1.2rem;display:inline-block;margin:0.75rem 0;color:var(--accent2)}
  .cta a{color:var(--accent);text-decoration:none;font-weight:600}
  .cta a:hover{text-decoration:underline}
  .radar-container{display:flex;justify-content:center;margin:2rem 0}
  .radar-chart{width:300px;height:300px}
  footer{text-align:center;padding:2rem 0;color:var(--muted);font-size:0.8rem}
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    ${user ? `<p class="user-tag">${escapeHtml(t('sharedBy').replace('{user}', user))}</p>` : ''}
    <h1>${escapeHtml(t('myAiSkillStack'))}</h1>
    <p class="subtitle">${data.totalCount} ${t('skillsScanned')} · ${totalCategories} ${t('categoriesCovered')}</p>
    <p class="persona">${escapeHtml(persona)}</p>
    <div class="radar-container">${radarChart}</div>
    <div class="stats">
      <div class="stat"><b>${data.totalCount}</b><span>${t('skillsScanned')}</span></div>
      <div class="stat"><b>${totalCategories}</b><span>${t('categoriesCovered')}</span></div>
    </div>
  </div>

  ${topPicksSection}

  <h2>${escapeHtml(t('categoryMap'))}</h2>
  <div class="grid">${categoryCards}</div>

  <div class="cta">
    <h2>${escapeHtml(t('poweredBy'))}</h2>
    <p>${escapeHtml(t('installSkillGuide'))}</p>
    <code>npx skill-guide --open</code>
    <p><a href="https://github.com/gtskevin/skill-guide">github.com/gtskevin/skill-guide</a></p>
  </div>
</div>
<footer>Generated by skill-guide</footer>
</body>
</html>`;
}

function main() {
  const mode = parseMode();
  if (mode.mode === 'help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const data = runScanner(mode);
  if (mode.mode === 'doctor') {
    process.stdout.write(`${printDoctor(data)}\n`);
    return;
  }

  if (mode.mode === 'recommend') {
    const registry = require('./skill-registry');
    const installed = data.skills;
    const refresh = hasFlag('--refresh');
    const onlineEntries = registry.fetchRegistry({ refresh });
    const recommendations = registry.recommend(installed, onlineEntries);

    const format = getArgValue('--format') || 'html';
    if (format === 'json') {
      process.stdout.write(JSON.stringify({ installed, recommendations }, null, 2) + '\n');
      process.exit(0);
    }

    const terminalOutput = renderRecommendTerminal(data, recommendations);
    process.stdout.write(terminalOutput);

    const shouldOpen = hasFlag('--open') && !hasFlag('--no-open');
    const outputFile = getArgValue('--output');
    if (shouldOpen || outputFile) {
      const html = renderRecommendHTML(data, recommendations, getArgValue('--user'));
      const defaultFile = path.join(os.tmpdir(), 'skill-guide-recommend.html');
      const targetFile = outputFile ? path.resolve(outputFile) : defaultFile;
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.writeFileSync(targetFile, html, 'utf8');
      if (shouldOpen) openFile(targetFile);
      process.stdout.write(`Generated: ${targetFile}\n`);
    }

    process.exit(0);
  }

  if (mode.mode === 'share') {
    const user = getArgValue('--user');
    const format = getArgValue('--format') || 'html';

    if (format === 'json') {
      process.stdout.write(JSON.stringify({ skills: data.skills, totalCount: data.totalCount }, null, 2) + '\n');
      process.exit(0);
    }

    const shouldOpen = hasFlag('--open') && !hasFlag('--no-open');
    const outputFile = getArgValue('--output');
    const html = renderShareHTML(data, user);
    const defaultFile = path.join(os.tmpdir(), 'skill-guide-share.html');
    const targetFile = outputFile ? path.resolve(outputFile) : defaultFile;
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, html, 'utf8');
    if (shouldOpen) openFile(targetFile);
    process.stdout.write(`Generated: ${targetFile}\n`);
    process.exit(0);
  }

  const format = getArgValue('--format') || 'html';
  if (!['html', 'json'].includes(format)) {
    process.stderr.write('Error: --format must be "html" or "json"\n');
    process.exit(1);
  }

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

  const output = path.resolve(getArgValue('--output') || defaultOutputPath(mode));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, renderHtml(data, mode), 'utf8');

  if (hasFlag('--open') && !hasFlag('--no-open')) openFile(output);
  process.stdout.write(`Generated ${output}\n`);
}

main();
