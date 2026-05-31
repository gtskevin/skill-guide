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
  assert.match(markdown, /--find/);
  assert.match(markdown, /--doctor/);
  assert.match(markdown, /--recommend/);
  assert.match(markdown, /--share/);
});
