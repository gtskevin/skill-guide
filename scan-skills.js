#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function hasFlag(flag) {
  return args.includes(flag);
}

const mode = hasFlag('--list') ? 'list'
  : hasFlag('--skill') ? 'skill'
  : hasFlag('--search') ? 'search'
  : hasFlag('--full') ? 'full'
  : null;

if (!mode) {
  process.stderr.write(
    'Usage:\n' +
    '  scan-skills.js --list              # name + description + category\n' +
    '  scan-skills.js --skill <name>      # full data for one skill\n' +
    '  scan-skills.js --search <query>    # match triggers + description\n' +
    '  scan-skills.js --full              # all skills with full data\n' +
    '  scan-skills.js --refresh           # force re-scan (combine with any mode)\n'
  );
  process.exit(1);
}

const skillName = getArgValue('--skill');
const searchQuery = getArgValue('--search');
const refresh = hasFlag('--refresh');

if (mode === 'skill' && !skillName) {
  process.stderr.write('Error: --skill requires a name argument\n');
  process.exit(1);
}
if (mode === 'search' && !searchQuery) {
  process.stderr.write('Error: --search requires a query argument\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------
const CACHE_DIR = path.join(os.tmpdir(), 'claude');
const CACHE_FILE = path.join(CACHE_DIR, 'skill-guide-cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const cached = JSON.parse(raw);
    if (Date.now() - cached._ts < CACHE_TTL_MS) {
      return cached;
    }
  } catch (_) { /* ignore */ }
  return null;
}

function writeCache(data) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    data._ts = Date.now();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf8');
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Frontmatter parser (regex-based, no YAML library)
// ---------------------------------------------------------------------------
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const raw = match[1];
  const result = {};
  let currentKey = null;
  let inMultiline = false;
  let multilineValue = '';
  let multilineType = '';

  const lines = raw.split('\n');
  for (const line of lines) {
    // Multi-line continuation
    if (inMultiline) {
      if (line.trim() === '' && multilineValue.length > 0) {
        multilineValue += '\n';
        continue;
      }
      if (line.startsWith('  ') || line.startsWith('\t')) {
        const val = line.trim();
        if (val.startsWith('- ')) {
          if (!Array.isArray(result[currentKey])) {
            result[currentKey] = [];
          }
          result[currentKey].push(stripQuotes(val.slice(2)));
        } else {
          multilineValue += (multilineValue ? '\n' : '') + val;
        }
        continue;
      }
      // End of multiline block
      if (multilineType === '|' || multilineType === '>') {
        if (multilineValue && !Array.isArray(result[currentKey])) {
          result[currentKey] = multilineValue.trim();
        }
      }
      inMultiline = false;
      multilineValue = '';
    }

    // Key: value
    const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let val = kvMatch[2].trim();

      // Multi-line indicators
      if (val === '|' || val === '>') {
        inMultiline = true;
        multilineType = val;
        multilineValue = '';
        result[currentKey] = '';
        continue;
      }

      // Inline list [a, b, c]
      if (val.startsWith('[') && val.endsWith(']')) {
        result[currentKey] = val.slice(1, -1).split(',').map(s => stripQuotes(s.trim())).filter(Boolean);
        continue;
      }

      // Empty value means next lines could be list
      if (val === '') {
        result[currentKey] = [];
        continue;
      }

      result[currentKey] = stripQuotes(val);
      continue;
    }

    // List item continuation
    const listItem = line.match(/^\s+-\s+(.*)/);
    if (listItem && currentKey) {
      if (!Array.isArray(result[currentKey])) {
        result[currentKey] = [];
      }
      result[currentKey].push(stripQuotes(listItem[1]));
    }
  }

  // Finalize trailing multiline
  if (inMultiline && multilineValue && currentKey && !Array.isArray(result[currentKey])) {
    result[currentKey] = multilineValue.trim();
  }

  return result;
}

function stripQuotes(val) {
  if (typeof val !== 'string') return val;
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Auto-categorization
// ---------------------------------------------------------------------------
const CATEGORY_MAP = [
  { category: 'testing',       keywords: /\b(test|tdd|spec|e2e|qa|assert|jest|vitest|playwright)\b/i },
  { category: 'design',        keywords: /\b(design|ui|ux|css|style|color|layout|figma|theme|visual|interface)\b/i },
  { category: 'security',      keywords: /\b(security|audit|vuln|owasp|xss|inject|auth|encrypt|cve)\b/i },
  { category: 'documentation', keywords: /\b(doc|readme|changelog|api-doc|markdown|mdx|writing)\b/i },
  { category: 'automation',    keywords: /\b(automat|script|batch|loop|cron|schedule|workflow)\b/i },
  { category: 'deployment',    keywords: /\b(deploy|release|ci.?cd|docker|kubernetes|infra|nginx|vercel)\b/i },
  { category: 'code-quality',  keywords: /\b(review|lint|refactor|simplif|clean|format|pattern)\b/i },
  { category: 'development',   keywords: /\b(develop|build|debug|investigate|plan|brainstorm|feature|implement)\b/i },
];

function categorize(name, description, triggers) {
  const text = [name, description, ...(triggers || [])].join(' ');
  for (const { category, keywords } of CATEGORY_MAP) {
    if (keywords.test(text)) return category;
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// Layer 2: Extract sections (## headings with first paragraph)
// ---------------------------------------------------------------------------
function extractSections(content) {
  const sections = [];
  // Remove code blocks
  const cleaned = content.replace(/```[\s\S]*?```/g, '');
  const lines = cleaned.split('\n');
  let currentHeading = null;
  let para = '';

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      // Save previous section
      if (currentHeading && para.trim().length > 0) {
        sections.push({ title: currentHeading, summary: para.trim().slice(0, 200) });
        if (sections.length >= 15) break;
      }
      currentHeading = headingMatch[1].trim();
      para = '';
      continue;
    }

    if (!currentHeading) continue;

    // Skip table lines, image lines
    if (line.startsWith('|') || line.match(/!\[.*\]/)) continue;
    if (line.trim() === '') {
      if (para.trim().length >= 20) continue; // end of paragraph
      continue;
    }
    // Skip sub-headings inside section
    if (line.startsWith('###')) continue;

    para += (para ? ' ' : '') + line.trim();
  }

  // Last section
  if (currentHeading && para.trim().length > 0 && sections.length < 15) {
    sections.push({ title: currentHeading, summary: para.trim().slice(0, 200) });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Layer 3: Extract contextual paragraphs
// ---------------------------------------------------------------------------
const PATTERN_MAP = {
  whenToUse:   /when\s+(?:to\s+)?use|何时用|适用场景/i,
  howItWorks:  /how\s+it\s+works|运作原理|how\s+to\s+use|workflow|流程/i,
  limitations: /limit|局限|not\s+do|anti.?pattern|caveat|注意事项/i,
};

function extractContextual(content) {
  const result = { whenToUse: '', howItWorks: '', limitations: '' };

  // Remove code blocks first
  const cleaned = content.replace(/```[\s\S]*?```/g, '');
  const paragraphs = cleaned.split(/\n\s*\n/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    const lines = trimmed.split('\n').filter(l => !l.startsWith('|') && !l.match(/^!\[/) && l.trim().length > 0);
    const text = lines.join(' ').trim();
    if (text.length < 20 || text.length > 800) continue;

    for (const [key, regex] of Object.entries(PATTERN_MAP)) {
      if (!result[key] && regex.test(text)) {
        result[key] = text.slice(0, 500);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Skill scanning
// ---------------------------------------------------------------------------
const HOME = os.homedir();

const SCAN_SOURCES = [
  { dir: path.join(HOME, '.claude', 'skills'),                  label: 'user',      priority: 1, depth: 1 },
  { dir: path.join(HOME, '.cc-switch', 'skills'),               label: 'cc-switch', priority: 2, depth: 1 },
  { dir: path.join(HOME, '.claude', 'plugins', 'marketplaces'), label: 'plugins',   priority: 3, depth: 2 },
];

function tryStatDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_) { return false; }
}

function scanDirectory(dirPath, maxDepth, currentDepth) {
  if (currentDepth > maxDepth) return [];
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (_) { return []; }

  const results = [];
  for (const entry of entries) {
    // Follow symlinks — entry.isDirectory() is false for symlinks without this
    const isDir = entry.isDirectory() || (entry.isSymbolicLink() && tryStatDir(path.join(dirPath, entry.name)));
    if (!isDir) continue;
    if (entry.name.startsWith('.')) continue;

    const subDir = path.join(dirPath, entry.name);

    // Check for SKILL.md or README.md
    const skillMd = path.join(subDir, 'SKILL.md');
    const readmeMd = path.join(subDir, 'README.md');
    let mdFile = null;

    if (fileExists(skillMd)) {
      mdFile = skillMd;
    } else if (fileExists(readmeMd)) {
      mdFile = readmeMd;
    }

    if (mdFile) {
      results.push({ dir: subDir, mdFile });
    }

    // Recurse deeper
    if (currentDepth < maxDepth) {
      const deeper = scanDirectory(subDir, maxDepth, currentDepth + 1);
      results.push(...deeper);
    }
  }
  return results;
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch (_) { return false; }
}

function loadSkill(dir, mdFile) {
  let content;
  try {
    content = fs.readFileSync(mdFile, 'utf8');
  } catch (_) { return null; }

  const fm = parseFrontmatter(content);
  const name = fm.name || path.basename(dir);
  const description = (fm.description || '').slice(0, 500);

  // Skill is valid if it has name or description in frontmatter
  if (!fm.name && !fm.description) return null;

  let triggers = fm.triggers || [];
  if (typeof triggers === 'string') triggers = [triggers];

  let allowedTools = fm['allowed-tools'] || fm.allowedTools || [];
  if (typeof allowedTools === 'string') allowedTools = [allowedTools];

  return {
    name,
    description,
    category: categorize(name, description, triggers),
    triggers,
    allowedTools,
    version: fm.version || '',
    dir,
    _mdFile: mdFile,
    _content: content,
  };
}

function scanAllSkills() {
  const allSkills = {};
  const sourceCounts = { user: 0, 'cc-switch': 0, plugins: 0 };

  for (const source of SCAN_SOURCES) {
    const dirs = scanDirectory(source.dir, source.depth, 0);
    for (const { dir, mdFile } of dirs) {
      const skill = loadSkill(dir, mdFile);
      if (!skill) continue;

      skill._source = source.label;
      sourceCounts[source.label] = (sourceCounts[source.label] || 0) + 1;

      const key = skill.name.toLowerCase();
      if (allSkills[key]) {
        // Keep higher priority, track all sources
        const existing = allSkills[key];
        existing.sources.push(source.label);
        if (source.priority < existing._priority) {
          // Replace with higher priority data
          skill.sources = existing.sources;
          skill._priority = source.priority;
          allSkills[key] = skill;
        }
      } else {
        skill.sources = [source.label];
        skill._priority = source.priority;
        allSkills[key] = skill;
      }
    }
  }

  return { skills: Object.values(allSkills), sourceCounts };
}

// ---------------------------------------------------------------------------
// Load full data (Layer 2 + 3) for a specific skill
// ---------------------------------------------------------------------------
function loadFullData(skill) {
  // Use cached content if available, otherwise re-read
  let content = skill._content;
  if (!content) {
    try {
      content = fs.readFileSync(skill._mdFile, 'utf8');
    } catch (_) { content = ''; }
  }

  const sections = extractSections(content);
  const contextual = extractContextual(content);

  return {
    ...skill,
    sections,
    howItWorks: contextual.howItWorks,
    whenToUse: contextual.whenToUse,
    limitations: contextual.limitations,
  };
}

// ---------------------------------------------------------------------------
// Clean skill for output (remove internal fields)
// ---------------------------------------------------------------------------
function cleanSkill(skill, includeFull) {
  const base = {
    name: skill.name,
    description: skill.description,
    category: skill.category,
    sources: skill.sources,
    triggers: skill.triggers,
    allowedTools: skill.allowedTools,
    version: skill.version,
    dir: skill.dir.replace(HOME, '~'),
  };

  if (includeFull) {
    const full = loadFullData(skill);
    base.sections = full.sections;
    base.howItWorks = full.howItWorks;
    base.whenToUse = full.whenToUse;
    base.limitations = full.limitations;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  let scanResult;

  // Try cache first
  if (!refresh) {
    const cached = readCache();
    if (cached && cached.skills) {
      scanResult = cached;
    }
  }

  if (!scanResult) {
    scanResult = scanAllSkills();
    // Cache the raw result
    const toCache = {
      scanDate: new Date().toISOString().slice(0, 10),
      totalCount: scanResult.skills.length,
      sourceCounts: scanResult.sourceCounts,
      skills: scanResult.skills.map(s => ({ ...s })),
    };
    writeCache(toCache);
  }

  // Fix scanDate if from cache
  if (!scanResult.scanDate) {
    scanResult.scanDate = new Date().toISOString().slice(0, 10);
  }

  const skills = scanResult.skills;
  const sourceCounts = scanResult.sourceCounts || {};

  let output;

  if (mode === 'list') {
    output = {
      scanDate: scanResult.scanDate,
      totalCount: skills.length,
      sources: sourceCounts,
      skills: skills.map(s => cleanSkill(s, false)),
    };
  } else if (mode === 'skill') {
    const found = skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
    if (!found) {
      output = { error: `Skill "${skillName}" not found`, skills: [] };
    } else {
      output = {
        scanDate: scanResult.scanDate,
        totalCount: skills.length,
        sources: sourceCounts,
        skills: [cleanSkill(found, true)],
      };
    }
  } else if (mode === 'search') {
    const q = searchQuery.toLowerCase();
    const matched = skills.filter(s => {
      const nameMatch = s.name.toLowerCase().includes(q);
      const descMatch = s.description.toLowerCase().includes(q);
      const triggerMatch = s.triggers.some(t => t.toLowerCase().includes(q));
      return nameMatch || descMatch || triggerMatch;
    });
    output = {
      scanDate: scanResult.scanDate,
      totalCount: skills.length,
      matchedCount: matched.length,
      sources: sourceCounts,
      skills: matched.map(s => cleanSkill(s, false)),
    };
  } else if (mode === 'full') {
    output = {
      scanDate: scanResult.scanDate,
      totalCount: skills.length,
      sources: sourceCounts,
      skills: skills.map(s => cleanSkill(s, true)),
    };
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
