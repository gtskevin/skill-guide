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
    '  skill-guide [--open] [--output <file>] [--format html|json] [--refresh]',
    '  skill-guide --search <query> [--open] [--output <file>] [--format html|json]',
    '  skill-guide --skill <name> [--open] [--output <file>] [--format html|json]',
    '  skill-guide --full [--open] [--output <file>] [--format html|json]',
    '  skill-guide --doctor [--refresh]',
    '',
    'Examples:',
    '  npx skill-guide --open',
    '  npx skill-guide --search security --open',
    '  npx skill-guide --doctor',
  ].join('\n');
}

function parseMode() {
  if (hasFlag('--help') || hasFlag('-h')) return { mode: 'help' };
  if (hasFlag('--doctor')) return { mode: 'doctor' };
  if (hasFlag('--full') || args[0] === 'all') return { mode: 'full' };

  const skill = getArgValue('--skill');
  if (skill) return { mode: 'skill', value: skill };

  const search = getArgValue('--search');
  if (search) return { mode: 'search', value: search };

  const valueFlags = new Set(['--output', '--skill', '--search', '--format']);
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
  if (hasClaude && hasCodex) return 'Your Agent Skills';
  if (hasCodex) return 'Your Codex Skills';
  if (hasClaude) return 'Your Claude Code Skills';
  return 'Your Agent Skills';
}

function sourceSummary(sources) {
  const labels = {
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
  const subtitle = sourceSummary(data.sources) || 'No skill sources found';
  const modeLabel = {
    list: 'Discovery',
    search: 'Tool Selection',
    skill: 'Skill Deep Dive',
    full: 'Complete Manual',
  }[mode.mode] || 'Discovery';

  return `<section class="slide cover">
    <div class="rv center">
      <div class="kicker">${escapeHtml(modeLabel)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="sub">${escapeHtml(data.totalCount || 0)} skills scanned · ${escapeHtml(subtitle)}</p>
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
      <p>${items.length} skills</p>
      <div class="chips">${items.slice(0, 8).map((skill) => `<span>${escapeHtml(skill.name)}</span>`).join('')}</div>
    </article>`).join('');

  return `<section class="slide">
    <div class="rv wide">
      <h2>Category Map</h2>
      <div class="grid">${cards || '<p class="empty">No skills found.</p>'}</div>
    </div>
  </section>`;
}

function renderHighlights(skills) {
  const highlights = [...skills]
    .sort((a, b) => ((b.triggers || []).length + (b.sources || []).length) - ((a.triggers || []).length + (a.sources || []).length))
    .slice(0, 8);

  return `<section class="slide">
    <div class="rv wide">
      <h2>Highlights</h2>
      <div class="list">${highlights.map((skill, index) => `<article class="row">
        <strong>${index + 1}</strong>
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <p>${escapeHtml(truncate(skill.description, 180))}</p>
          <div>${categoryBadge(skill.category)}${sourceBadges(skill.sources)}</div>
        </div>
      </article>`).join('')}</div>
    </div>
  </section>`;
}

function renderReference(skills, title = 'Quick Reference') {
  const rows = skills.map((skill) => `<tr>
    <td>${escapeHtml(skill.name)}</td>
    <td>${categoryBadge(skill.category)}</td>
    <td>${escapeHtml(truncate(skill.description, 160))}</td>
    <td>${escapeHtml((skill.triggers || []).slice(0, 4).join(', '))}</td>
  </tr>`).join('');

  return `<section class="slide">
    <div class="rv wide">
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Category</th><th>Description</th><th>Triggers</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
  </section>`;
}

function renderSkillDetails(skills) {
  return skills.map((skill) => `<section class="slide">
    <div class="rv wide detail">
      <h2>${escapeHtml(skill.name)}</h2>
      <p class="sub">${escapeHtml(skill.description)}</p>
      <div class="meta">${categoryBadge(skill.category)}${sourceBadges(skill.sources)}${(skill.allowedTools || []).map((tool) => `<code>${escapeHtml(tool)}</code>`).join('')}</div>
      ${skill.whenToUse ? `<h3>When to Use</h3><p>${escapeHtml(skill.whenToUse)}</p>` : ''}
      ${skill.howItWorks ? `<h3>How It Works</h3><p>${escapeHtml(skill.howItWorks)}</p>` : ''}
      ${skill.limitations ? `<h3>Limitations</h3><p>${escapeHtml(skill.limitations)}</p>` : ''}
      ${(skill.sections || []).length ? `<div class="steps">${skill.sections.slice(0, 8).map((section, index) => `<article><b>${index + 1}</b><span>${escapeHtml(section.title)}</span><p>${escapeHtml(section.summary)}</p></article>`).join('')}</div>` : ''}
    </div>
  </section>`).join('');
}

function renderSelection(data, mode) {
  return `<section class="slide">
    <div class="rv wide">
      <h2>Match Results</h2>
      <p class="quote">${escapeHtml(mode.value || '')}</p>
      <div class="list">${data.skills.slice(0, 12).map((skill, index) => `<article class="row">
        <strong>${index + 1}</strong>
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <p>${escapeHtml(truncate(skill.description, 220))}</p>
          <div>${categoryBadge(skill.category)}${sourceBadges(skill.sources)}</div>
        </div>
      </article>`).join('')}</div>
    </div>
  </section>${renderReference(data.skills.slice(0, 20), 'Comparison Reference')}`;
}

function renderSlides(data, mode) {
  if (data.error) {
    return `${renderCover(data, mode)}<section class="slide"><div class="rv center"><h2>Error</h2><p class="sub">${escapeHtml(data.error)}</p></div></section>`;
  }

  if (mode.mode === 'search') return `${renderCover(data, mode)}${renderSelection(data, mode)}`;
  if (mode.mode === 'skill') return `${renderCover(data, mode)}${renderSkillDetails(data.skills)}`;
  if (mode.mode === 'full') return `${renderCover(data, mode)}${renderCategorySlide(data.skills)}${renderSkillDetails(data.skills)}${renderReference(data.skills, 'Complete Reference')}`;
  return `${renderCover(data, mode)}${renderCategorySlide(data.skills)}${renderHighlights(data.skills)}${renderReference(data.skills)}`;
}

function renderHtml(data, mode) {
  const slides = renderSlides(data, mode);
  return `<!DOCTYPE html>
<html lang="en">
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
