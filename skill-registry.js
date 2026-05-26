#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------
const CACHE_DIR = path.join(os.tmpdir(), 'claude');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(urls) {
  const joined = urls.join('|');
  return crypto.createHash('sha1').update(joined).digest('hex').slice(0, 12);
}

function cacheFile(urls) {
  return path.join(CACHE_DIR, `skill-registry-${cacheKey(urls)}.json`);
}

function readCache(urls) {
  try {
    const raw = fs.readFileSync(cacheFile(urls), 'utf8');
    const cached = JSON.parse(raw);
    if (Date.now() - cached._ts < CACHE_TTL_MS) {
      return cached;
    }
  } catch (_) { /* ignore */ }
  return null;
}

function writeCache(data, urls) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    data._ts = Date.now();
    fs.writeFileSync(cacheFile(urls), JSON.stringify(data), 'utf8');
  } catch (_) { /* ignore */ }
}

function clearCache(urls) {
  try {
    fs.unlinkSync(cacheFile(urls));
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Markdown parser for awesome-lists
// ---------------------------------------------------------------------------
function parseMarkdownList(markdown, source) {
  const entries = [];

  // Pattern 1: Bullet list — - [name](url) - description
  const bulletRe = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—]\s*(.+)$/gm;
  let match;
  while ((match = bulletRe.exec(markdown)) !== null) {
    const url = match[2].trim();
    // Skip TOC anchor links
    if (url.startsWith('#')) continue;
    entries.push({
      name: match[1].trim(),
      url,
      description: match[3].trim(),
      source,
    });
  }

  // Pattern 2: Table — | [name](url) | description |
  const tableRe = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.+?)\s*\|$/gm;
  while ((match = tableRe.exec(markdown)) !== null) {
    if (/^[-\s|]+$/.test(match[0])) continue;
    entries.push({
      name: match[1].trim(),
      url: match[2].trim(),
      description: match[3].replace(/[*_`]/g, '').trim(),
      source,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Registry URLs
// ---------------------------------------------------------------------------
const REGISTRY_URLS = [
  'https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/master/README.md',
  'https://raw.githubusercontent.com/ComposioHQ/awesome-codex-skills/main/README.md',
];

const REGISTRY_SOURCES = {
  'https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/master/README.md': 'awesome-claude-skills',
  'https://raw.githubusercontent.com/ComposioHQ/awesome-codex-skills/main/README.md': 'awesome-codex-skills',
};

function fetchRegistry(opts = {}) {
  const { refresh = false } = opts;

  if (!refresh) {
    const cached = readCache(REGISTRY_URLS);
    if (cached && cached.entries) return cached.entries;
  }

  if (process.env.SKILL_REGISTRY_OFFLINE === '1') {
    return [];
  }

  const { execFileSync } = require('child_process');
  const allEntries = [];

  for (const url of REGISTRY_URLS) {
    try {
      const { spawnSync } = require('child_process');
      const result = spawnSync('curl', ['-sL', '--max-time', '10', url], {
        encoding: 'utf8',
        timeout: 15000,
        shell: true,
      });
      const markdown = result.stdout || '';

      if (markdown && !markdown.includes('404: Not Found')) {
        const source = REGISTRY_SOURCES[url] || 'unknown';
        const entries = parseMarkdownList(markdown, source);
        allEntries.push(...entries);
      }
    } catch (_) { /* offline or timeout */ }
  }

  const seen = new Map();
  for (const entry of allEntries) {
    const key = entry.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, entry);
    } else {
      const existing = seen.get(key);
      if (!existing.sources) existing.sources = [existing.source];
      existing.sources.push(entry.source);
    }
  }

  const entries = Array.from(seen.values());
  writeCache({ entries }, REGISTRY_URLS);
  return entries;
}

// ---------------------------------------------------------------------------
// Category constants (mirrored from scan-skills.js CATEGORY_MAP)
// ---------------------------------------------------------------------------
const ALL_CATEGORIES = ['testing', 'design', 'security', 'documentation', 'automation', 'deployment', 'code-quality', 'development'];

function categorizeOnlineSkill(entry) {
  const text = [entry.name, entry.description].join(' ');
  const rules = [
    { category: 'testing',       keywords: /\b(test|tdd|spec|e2e|qa|assert|jest|vitest|playwright)\b/i },
    { category: 'design',        keywords: /\b(design|ui|ux|css|style|color|layout|figma|theme|visual|interface)\b/i },
    { category: 'security',      keywords: /\b(security|audit|vuln|owasp|xss|inject|auth|encrypt|cve)\b/i },
    { category: 'documentation', keywords: /\b(doc|readme|changelog|api-doc|markdown|mdx|writing)\b/i },
    { category: 'automation',    keywords: /\b(automat|script|batch|loop|cron|schedule|workflow)\b/i },
    { category: 'deployment',    keywords: /\b(deploy|release|ci.?cd|docker|kubernetes|infra|nginx|vercel)\b/i },
    { category: 'code-quality',  keywords: /\b(review|lint|refactor|simplif|clean|format|pattern)\b/i },
    { category: 'development',   keywords: /\b(develop|build|debug|investigate|plan|brainstorm|feature|implement)\b/i },
  ];
  for (const { category, keywords } of rules) {
    if (keywords.test(text)) return category;
  }
  return 'other';
}

const GAP_ACTIONS = {
  testing: 'Add a TDD skill to catch bugs before they ship',
  design: 'Add a UI/UX skill to improve your frontend output',
  security: 'Add a security audit skill to catch vulnerabilities',
  documentation: 'Add a docs skill to keep your project well-documented',
  automation: 'Add an automation skill to eliminate repetitive tasks',
  deployment: 'Add a deploy skill to streamline your CI/CD pipeline',
  'code-quality': 'Add a code review skill to maintain standards',
  development: 'Add a dev workflow skill to boost productivity',
};

function recommend(installed, onlineEntries) {
  const results = [];

  const installedByCategory = {};
  for (const skill of installed) {
    const cat = skill.category || 'other';
    if (!installedByCategory[cat]) installedByCategory[cat] = [];
    installedByCategory[cat].push(skill);
  }

  const categorizedOnline = onlineEntries.map((e) => ({
    ...e,
    category: categorizeOnlineSkill(e),
  }));

  // 1. Gap analysis — categories with no installed skills
  for (const cat of ALL_CATEGORIES) {
    if (!installedByCategory[cat] || installedByCategory[cat].length === 0) {
      const catSkills = categorizedOnline.filter((e) => e.category === cat).slice(0, 3);
      results.push({
        type: 'gap',
        category: cat,
        message: `You have no ${cat} skills installed`,
        action: GAP_ACTIONS[cat] || `Explore ${cat} skills to fill this gap`,
        skills: catSkills.map((s) => ({ name: s.name, description: s.description, url: s.url })),
      });
    }
  }

  // 2. Overlap detection — categories with 3+ skills
  for (const [cat, skills] of Object.entries(installedByCategory)) {
    if (skills.length >= 3) {
      const MAX_OVERLAP_SHOWN = 8;
      const shown = skills.slice(0, MAX_OVERLAP_SHOWN);
      const remaining = skills.length - shown.length;
      results.push({
        type: 'overlap',
        category: cat,
        count: skills.length,
        message: `You have ${skills.length} skills in "${cat}" category`,
        skills: shown.map((s) => s.name),
        hasMore: remaining > 0,
        remainingCount: remaining,
      });
    }
  }

  // 3. Popular skills not installed
  const installedNames = new Set(installed.map((s) => s.name.toLowerCase()));
  const popularityMap = new Map();
  for (const entry of categorizedOnline) {
    const key = entry.name.toLowerCase();
    if (!installedNames.has(key)) {
      const existing = popularityMap.get(key) || { ...entry, count: 0, sources: [] };
      existing.count++;
      if (!existing.sources.includes(entry.source)) existing.sources.push(entry.source);
      popularityMap.set(key, existing);
    }
  }

  const popular = Array.from(popularityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  for (const skill of popular) {
    results.push({
      type: 'popular',
      name: skill.name,
      description: skill.description,
      url: skill.url,
      sources: skill.sources,
      message: `Found in ${skill.count} awesome-list(s)`,
    });
  }

  const order = { gap: 0, popular: 1, overlap: 2 };
  results.sort((a, b) => (order[a.type] || 9) - (order[b.type] || 9));

  return results;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  ALL_CATEGORIES: ALL_CATEGORIES,
  _cacheKey: cacheKey,
  _readCache: readCache,
  _writeCache: writeCache,
  _parseMarkdownList: parseMarkdownList,
  REGISTRY_URLS: REGISTRY_URLS,
  clearCache: clearCache,
  fetchRegistry: fetchRegistry,
  recommend: recommend,
};
