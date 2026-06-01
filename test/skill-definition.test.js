'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const skillFile = path.join(root, 'SKILL.md');

test('SKILL.md is a concise CLI wrapper with trigger-first frontmatter', () => {
  const markdown = fs.readFileSync(skillFile, 'utf8');
  const description = markdown.match(/^description:\s*(.+)$/m)?.[1] || '';
  const wordCount = markdown.trim().split(/\s+/).length;

  assert.match(description, /^Use when\b/);
  assert.ok(wordCount < 500, `SKILL.md should stay under 500 words, got ${wordCount}`);
  assert.doesNotMatch(markdown, /Post-translate for non-English languages/);
  assert.doesNotMatch(markdown, /Write the translated HTML back/);
  assert.ok(markdown.match(/--find/) || markdown.match(/skill-guide: find/), 'must reference find mode');
  assert.ok(markdown.match(/--doctor/) || markdown.match(/skill-guide: doctor/), 'must reference doctor mode');
  assert.ok(markdown.match(/--recommend/) || markdown.match(/skill-guide: recommend/), 'must reference recommend mode');
  assert.ok(markdown.match(/--share/) || markdown.match(/skill-guide: share/), 'must reference share mode');
  assert.ok(markdown.match(/--check/) || markdown.match(/skill-guide: lint/), 'must reference check mode');
});
