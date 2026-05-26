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
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  _cacheKey: cacheKey,
  _readCache: readCache,
  _writeCache: writeCache,
  clearCache: clearCache,
};
