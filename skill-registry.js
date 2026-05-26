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
    entries.push({
      name: match[1].trim(),
      url: match[2].trim(),
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
  'https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/main/README.md',
  'https://raw.githubusercontent.com/ComposioHQ/awesome-codex-skills/main/README.md',
];

const REGISTRY_SOURCES = {
  'https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/main/README.md': 'awesome-claude-skills',
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
      const markdown = execFileSync(process.execPath, [
        '-e',
        `const https = require('https'); https.get(process.argv[1], {timeout: 10000}, (res) => { if (res.statusCode !== 200) { process.exit(0); } let d = ''; res.on('data', c => d += c); res.on('end', () => process.stdout.write(d)); }).on('error', () => {})`,
        url,
      ], { encoding: 'utf8', timeout: 15000 });

      if (markdown) {
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
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  _cacheKey: cacheKey,
  _readCache: readCache,
  _writeCache: writeCache,
  _parseMarkdownList: parseMarkdownList,
  REGISTRY_URLS: REGISTRY_URLS,
  clearCache: clearCache,
  fetchRegistry: fetchRegistry,
};
