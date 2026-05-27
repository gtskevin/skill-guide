#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

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
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey() {
  const roots = SCAN_SOURCES.map((source) => `${source.label}:${path.resolve(source.dir)}`).join('|');
  return crypto.createHash('sha1').update(roots).digest('hex').slice(0, 12);
}

function getCacheFile() {
  return path.join(CACHE_DIR, `skill-guide-cache-${getCacheKey()}.json`);
}

function readCache() {
  try {
    const CACHE_FILE = getCacheFile();
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
    const CACHE_FILE = getCacheFile();
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
      if (/^[>|]/.test(multilineType)) {
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

      // Multi-line indicators — skip if value is quoted
      const isQuoted = (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
      if (!isQuoted && /^[>|](-|\+)?$/.test(val)) {
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

function categorize(name, description, triggers, tags) {
  // Priority 1: tags match
  if (tags && tags.length > 0) {
    const tagText = tags.join(' ');
    for (const { category, keywords } of CATEGORY_MAP) {
      if (keywords.test(tagText)) return category;
    }
  }

  // Priority 2: description match
  const text = [name, description, ...(triggers || [])].join(' ');
  for (const { category, keywords } of CATEGORY_MAP) {
    if (keywords.test(text)) return category;
  }
  return 'other';
}

function smartTruncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSentence = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('! '), truncated.lastIndexOf('? '));
  if (lastSentence > maxLen * 0.5) return truncated.slice(0, lastSentence + 1);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.5) return truncated.slice(0, lastSpace) + '...';
  return truncated + '...';
}

// ---------------------------------------------------------------------------
// Layer 1.5: Extract summary (first body paragraph before headings)
// ---------------------------------------------------------------------------
function extractSummary(bodyContent) {
  const paragraphs = bodyContent.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('##')) break;
    if (trimmed.startsWith('```')) continue;
    if (trimmed.match(/^!\[/)) continue;
    if (trimmed.startsWith('|')) continue;
    const text = trimmed.replace(/\s+/g, ' ').trim();
    if (text.length >= 20) {
      return smartTruncate(text, 200);
    }
  }
  return '';
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
        sections.push({ title: currentHeading, summary: smartTruncate(para.trim(), 600) });
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
    sections.push({ title: currentHeading, summary: smartTruncate(para.trim(), 600) });
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
const CODEX_HOME = process.env.CODEX_HOME || path.join(HOME, '.codex');

function buildScanSources() {
  const rawSources = [
    { dir: path.join(HOME, '.claude', 'skills'),                  label: 'claude-user',  priority: 1, depth: 1 },
    { dir: path.join(CODEX_HOME, 'skills', '.system'),            label: 'openai-system', priority: 0, depth: 1 },
    { dir: path.join(CODEX_HOME, 'skills'),                       label: 'codex-user',   priority: 1, depth: 1 },
    { dir: path.join(HOME, '.cc-switch', 'skills'),               label: 'cc-switch',    priority: 2, depth: 1 },
    { dir: path.join(HOME, '.claude', 'plugins', 'marketplaces'), label: 'claude-plugin', priority: 3, depth: 2 },
    { dir: path.join(CODEX_HOME, 'plugins', 'cache'),             label: 'codex-plugin', priority: 3, depth: 4 },
  ];

  const seen = new Set();
  return rawSources.filter((source) => {
    const key = path.resolve(source.dir);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SCAN_SOURCES = buildScanSources();

function tryStatDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_) { return false; }
}

function scanDirectory(dirPath, maxDepth, currentDepth, options = {}) {
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
    if (!options.includeHidden && entry.name.startsWith('.')) continue;

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
      const deeper = scanDirectory(subDir, maxDepth, currentDepth + 1, options);
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

  let tags = fm.tags || [];
  if (typeof tags === 'string') tags = [tags];

  return {
    name,
    description,
    category: categorize(name, description, triggers, tags),
    triggers,
    allowedTools,
    tags,
    version: fm.version || '',
    dir,
    _mdFile: mdFile,
    _content: content,
  };
}

function scanAllSkills() {
  const allSkills = {};
  const sourceCounts = Object.fromEntries(SCAN_SOURCES.map((source) => [source.label, 0]));

  for (const source of SCAN_SOURCES) {
    const dirs = scanDirectory(source.dir, source.depth, 0, { includeHidden: source.includeHidden });
    for (const { dir, mdFile } of dirs) {
      const skill = loadSkill(dir, mdFile);
      if (!skill) continue;

      skill._source = source.label;
      sourceCounts[source.label] = (sourceCounts[source.label] || 0) + 1;

      const key = skill.name.toLowerCase();
      if (allSkills[key]) {
        // Keep higher priority, track all sources
        const existing = allSkills[key];
        if (!existing.sources.includes(source.label)) {
          existing.sources.push(source.label);
        }
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

  // Strip frontmatter before body extraction
  const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '');

  const sections = extractSections(bodyContent);
  const contextual = extractContextual(bodyContent);
  const summary = extractSummary(bodyContent);

  return {
    ...skill,
    sections,
    summary,
    howItWorks: contextual.howItWorks,
    whenToUse: contextual.whenToUse,
    limitations: contextual.limitations,
  };
}

// ---------------------------------------------------------------------------
// Compute completeness score (0-100) for documentation quality
// ---------------------------------------------------------------------------
const GARBAGE_PATTERNS = /^[>|](-|\+)?$|^---|^\s*$|^category:|^tags:/;

function computeCompleteness(skill, full) {
  let score = 0;

  // description: 20 points — non-empty and not a YAML artifact
  if (skill.description && skill.description.length > 2 && !GARBAGE_PATTERNS.test(skill.description)) {
    score += 20;
  }

  // summary: 20 points — non-empty and not a YAML artifact
  if (full && full.summary && full.summary.length > 0 && !GARBAGE_PATTERNS.test(full.summary)) {
    score += 20;
  }

  // whenToUse: 20 points — non-empty and no YAML leakage
  if (full && full.whenToUse && full.whenToUse.length > 20 && !full.whenToUse.startsWith('---')) {
    score += 20;
  }

  // howItWorks: 10 points — no YAML metadata
  if (full && full.howItWorks && full.howItWorks.length > 20 &&
      !/^---/.test(full.howItWorks) && !/^category:/.test(full.howItWorks) && !/^tags:/.test(full.howItWorks)) {
    score += 10;
  }

  // tags: 10 points
  if (skill.tags && skill.tags.length > 0) {
    score += 10;
  }

  // triggers: 10 points
  if (skill.triggers && skill.triggers.length > 0) {
    score += 10;
  }

  // limitations: 10 points
  if (full && full.limitations && full.limitations.length > 10) {
    score += 10;
  }

  return score;
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
    tags: skill.tags,
    allowedTools: skill.allowedTools,
    version: skill.version,
    dir: skill.dir.replace(HOME, '~'),
  };

  if (includeFull) {
    const full = loadFullData(skill);
    base.sections = full.sections;
    base.summary = full.summary;
    base.howItWorks = full.howItWorks;
    base.whenToUse = full.whenToUse;
    base.limitations = full.limitations;
    base.completeness = computeCompleteness(skill, full);
  }

  return base;
}

function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 characters per token for English text
  // This is conservative; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

function computeHealthStats(skills) {
  const CONTEXT_WINDOW = 200_000; // Claude's context window
  const DESCRIPTION_BUDGET = 16_000; // ~1% of context for skill descriptions
  const STALE_DAYS = 30;

  let totalDescriptionLength = 0;
  let totalTokenEstimate = 0;
  const staleSkills = [];
  const securityFlags = [];
  const duplicates = new Map();

  for (const skill of skills) {
    // Token cost
    const descLen = (skill.description || '').length;
    totalDescriptionLength += descLen;
    totalTokenEstimate += estimateTokens(skill.description);

    // Stale detection (based on file mtime)
    try {
      const stat = fs.statSync(skill._mdFile);
      const daysSinceModified = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
      if (daysSinceModified > STALE_DAYS) {
        staleSkills.push({
          name: skill.name,
          daysSinceModified: Math.floor(daysSinceModified),
          lastModified: stat.mtime.toISOString().slice(0, 10),
        });
      }
    } catch (_) { /* ignore stat errors */ }

    // Security red flags (simple patterns)
    const content = (skill._content || '').toLowerCase();
    const flags = [];
    if (content.includes('curl ') && content.includes(' | ')) flags.push('pipe-from-curl');
    if (content.includes('eval(') || content.includes('exec(')) flags.push('eval-exec');
    if (content.includes('api_key') || content.includes('apikey') || content.includes('token')) flags.push('handles-secrets');
    if (content.includes('rm -rf') || content.includes('rmdir /s')) flags.push('destructive-commands');
    if (flags.length > 0) {
      securityFlags.push({ name: skill.name, flags });
    }

    // Duplicate detection (by normalized name)
    const normalizedName = skill.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (duplicates.has(normalizedName)) {
      duplicates.get(normalizedName).push(skill.name);
    } else {
      duplicates.set(normalizedName, [skill.name]);
    }
  }

  // Filter out non-duplicates
  const duplicateGroups = [...duplicates.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([normalized, names]) => ({ normalized, names }));

  // Hidden skills calculation
  const hiddenCount = DESCRIPTION_BUDGET > 0
    ? Math.max(0, Math.floor((totalDescriptionLength - DESCRIPTION_BUDGET) / 100))
    : 0;

  return {
    totalSkills: skills.length,
    totalDescriptionLength,
    totalTokenEstimate,
    descriptionBudget: DESCRIPTION_BUDGET,
    budgetUsedPercent: Math.round((totalDescriptionLength / DESCRIPTION_BUDGET) * 100),
    hiddenSkillEstimate: Math.min(hiddenCount, skills.length),
    staleSkills: staleSkills.sort((a, b) => b.daysSinceModified - a.daysSinceModified),
    securityFlags,
    duplicateGroups,
    contextWindowPercent: Math.round((totalTokenEstimate / CONTEXT_WINDOW) * 100 * 100) / 100,
  };
}

function normalizeSkillName(name) {
  return String(name || '').replace(/^[^:]+:/, '').toLowerCase();
}

function findSkill(skills, requestedName) {
  const requested = String(requestedName || '').toLowerCase();
  const bareRequested = normalizeSkillName(requestedName);

  const exact = skills.find((skill) => {
    const name = skill.name.toLowerCase();
    const bareName = normalizeSkillName(skill.name);
    return name === requested || bareName === bareRequested;
  });
  if (exact) return exact;

  const prefixMatches = skills
    .filter((skill) => normalizeSkillName(skill.name).startsWith(bareRequested))
    .sort((a, b) => normalizeSkillName(a.name).length - normalizeSkillName(b.name).length
      || a.name.localeCompare(b.name));
  if (prefixMatches.length > 0) return prefixMatches[0];

  const containsMatches = skills
    .filter((skill) => normalizeSkillName(skill.name).includes(bareRequested))
    .sort((a, b) => normalizeSkillName(a.name).length - normalizeSkillName(b.name).length
      || a.name.localeCompare(b.name));
  return containsMatches[0] || null;
}

function suggestSkills(skills, requestedName) {
  const requested = normalizeSkillName(requestedName);
  return skills
    .filter((skill) => {
      const name = normalizeSkillName(skill.name);
      const description = String(skill.description || '').toLowerCase();
      const triggers = (skill.triggers || []).join(' ').toLowerCase();
      return name.includes(requested) || description.includes(requested) || triggers.includes(requested);
    })
    .slice(0, 8)
    .map((skill) => cleanSkill(skill, false));
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
    const found = findSkill(skills, skillName);
    if (!found) {
      output = {
        error: `Skill "${skillName}" not found`,
        scanDate: scanResult.scanDate,
        totalCount: skills.length,
        sources: sourceCounts,
        skills: [],
        suggestions: suggestSkills(skills, skillName),
      };
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
