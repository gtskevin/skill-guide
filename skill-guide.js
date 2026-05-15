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
    '  skill-guide --doctor [--refresh]',
    '',
    'Examples:',
    '  npx skill-guide --open',
    '  npx skill-guide --search security --open',
    '  npx skill-guide --skill tdd --lang zh --open',
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
  } else if (mode.mode === 'full') {
    scannerArgs.push('--full');
  }

  return scannerArgs;
}

function runScanner(mode) {
  const output = execFileSync(process.execPath, [SCANNER, ...scannerArgsFor(mode)], {
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
      <div class="kicker">${escapeHtml(modeLabel)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="sub">${escapeHtml(data.totalCount || 0)} ${t('skillsScanned')} · ${escapeHtml(subtitle)}</p>
      <div class="stats">${Object.entries(data.sources || {}).map(([source, count]) => `<div class="stat"><b>${count}</b><span>${escapeHtml(source)}</span></div>`).join('')}</div>
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
      <h2>${t('categoryMap')}</h2>
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
      <h2>${t('highlights')}</h2>
      <div class="list">${highlights.map((skill, index) => `<article class="row">
        <strong>${index + 1}</strong>
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <p>${te(truncate(skill.description, 180))}</p>
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
    <td>${te(truncate(skill.description, 160))}</td>
    <td>${escapeHtml((skill.triggers || []).slice(0, 4).join(', '))}</td>
  </tr>`).join('');

  return `<section class="slide">
    <div class="rv wide">
      <h2>${escapeHtml(refTitle)}</h2>
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
      <p class="sub">${te(skill.description)}</p>
      <div class="meta">${categoryBadge(skill.category)}${sourceBadges(skill.sources)}${(skill.allowedTools || []).map((tool) => `<code>${escapeHtml(tool)}</code>`).join('')}</div>
      ${skill.whenToUse ? `<h3>${t('whenToUse')}</h3><p>${te(skill.whenToUse)}</p>` : ''}
      ${skill.howItWorks ? `<h3>${t('howItWorks')}</h3><p>${te(skill.howItWorks)}</p>` : ''}
      ${skill.limitations ? `<h3>${t('limitations')}</h3><p>${te(skill.limitations)}</p>` : ''}
      ${(skill.sections || []).length ? `<div class="steps">${skill.sections.slice(0, 8).map((section, index) => `<article><b>${index + 1}</b><span>${te(section.title)}</span><p>${te(section.summary)}</p></article>`).join('')}</div>` : ''}
    </div>
  </section>`).join('');
}

function renderSelection(data, mode) {
  return `<section class="slide">
    <div class="rv wide">
      <h2>${t('matchResults')}</h2>
      <p class="quote">${escapeHtml(mode.value || '')}</p>
      <div class="list">${data.skills.slice(0, 12).map((skill, index) => `<article class="row">
        <strong>${index + 1}</strong>
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <p>${te(truncate(skill.description, 220))}</p>
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
:root{--bg:#eef2ff;--card:#fff;--t:#1e293b;--muted:#64748b;--ab:#818cf8;--ap:#f0abfc;--am:#6ee7b7;--ao:#fdba74;--r:14px;--shadow:0 14px 45px rgba(79,70,229,.10)}
*{box-sizing:border-box}html{scroll-snap-type:y mandatory;scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--t);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.slide{min-height:100vh;min-height:100dvh;scroll-snap-align:start;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:clamp(28px,5vw,64px)}.slide:before,.slide:after{content:"";position:absolute;border-radius:999px;filter:blur(80px);opacity:.28;pointer-events:none}.slide:before{width:420px;height:420px;background:var(--ab);left:-120px;top:-120px}.slide:after{width:360px;height:360px;background:var(--ap);right:-120px;bottom:-120px}.center,.wide{position:relative;z-index:1}.center{text-align:center;max-width:980px}.wide{width:min(1120px,100%)}h1{font-size:clamp(42px,7vw,86px);line-height:1.02;margin:0 0 18px;font-weight:850;letter-spacing:0;background:linear-gradient(135deg,var(--ab),var(--ap),var(--am));-webkit-background-clip:text;color:transparent}h2{font-size:clamp(28px,4vw,52px);line-height:1.08;margin:0 0 28px;text-align:center;letter-spacing:0}h3{margin:0 0 8px;font-size:18px}.sub{font-size:clamp(16px,2vw,22px);line-height:1.5;color:var(--muted);margin:0 auto 26px;max-width:880px}.kicker{text-transform:uppercase;letter-spacing:.14em;color:#6366f1;font-size:12px;font-weight:800;margin-bottom:18px}.stats{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}.stat{background:rgba(255,255,255,.78);box-shadow:var(--shadow);border-radius:var(--r);padding:14px 18px;min-width:126px}.stat b{display:block;font-size:28px}.stat span{display:block;color:var(--muted);font-size:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}.card,.row{background:rgba(255,255,255,.86);box-shadow:var(--shadow);border-radius:var(--r)}.card{padding:20px}.card p,.row p,.detail p{color:var(--muted);line-height:1.5}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.chips span,.badge,.source{display:inline-flex;align-items:center;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700}.chips span{background:#f8fafc;color:#475569}.badge{background:#e0e7ff;color:#3730a3;margin-right:6px}.source{background:#ecfeff;color:#0e7490;margin-right:6px}.list{display:flex;flex-direction:column;gap:14px}.row{display:grid;grid-template-columns:48px 1fr;gap:14px;padding:18px}.row strong{font-size:28px;color:var(--ab);line-height:1}.table-wrap{max-height:72vh;overflow:auto;border-radius:var(--r);box-shadow:var(--shadow);background:var(--card)}table{border-collapse:collapse;width:100%;font-size:14px}th{position:sticky;top:0;background:#6366f1;color:white;text-align:left}th,td{padding:12px 14px;border-bottom:1px solid #eef2ff}tr:nth-child(even){background:#fafbff}.meta{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:16px 0 26px}.meta code{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px}.detail{text-align:center}.detail h3{margin-top:24px}.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:20px;text-align:left}.steps article{background:#fff;border-radius:var(--r);box-shadow:var(--shadow);padding:16px}.steps b{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:999px;background:var(--ab);color:white;margin-right:8px}.quote{font-size:20px;color:var(--muted);text-align:center;background:#fff;border-radius:var(--r);padding:18px;box-shadow:var(--shadow)}.empty{text-align:center;color:var(--muted)}.rv{opacity:0;transform:translateY(24px);transition:opacity .55s ease,transform .55s ease}.rv.v{opacity:1;transform:none}@media(prefers-reduced-motion:reduce){.rv{opacity:1;transform:none;transition:none}}@media(max-width:760px){.slide{padding:24px 16px}.row{grid-template-columns:1fr}.row strong{font-size:18px}.table-wrap{max-height:65vh}}
</style>
</head>
<body>
${slides}
<script>
const seen=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('v')}),{threshold:.15});
document.querySelectorAll('.rv').forEach(el=>seen.observe(el));
const slides=[...document.querySelectorAll('.slide')];
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

  const output = path.resolve(getArgValue('--output') || defaultOutputPath(mode));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, renderHtml(data, mode), 'utf8');

  if (hasFlag('--open') && !hasFlag('--no-open')) openFile(output);
  process.stdout.write(`Generated ${output}\n`);
}

main();
