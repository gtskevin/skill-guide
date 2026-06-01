'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('plugin.json is valid JSON with correct fields', () => {
  const raw = fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8');
  const plugin = JSON.parse(raw);

  assert.equal(plugin.name, 'skill-guide');
  assert.ok(Array.isArray(plugin.commands));
  assert.equal(plugin.commands[0], './commands/');
  assert.ok(plugin.description.length > 10);
});

test('all expected command files exist', () => {
  const expected = ['dashboard.md', 'review.md', 'find.md', 'recommend.md', 'share.md', 'doctor.md', 'lint.md'];
  const commandsDir = path.join(root, 'commands');

  for (const name of expected) {
    const filePath = path.join(commandsDir, name);
    assert.ok(fs.existsSync(filePath), `Missing command file: ${name}`);
  }
});

test('each command has valid frontmatter with description', () => {
  const commandsDir = path.join(root, 'commands');
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    assert.ok(match, `${file}: missing frontmatter`);

    const descMatch = match[1].match(/^description:\s*["']?(.+?)["']?\s*$/m);
    assert.ok(descMatch, `${file}: missing description in frontmatter`);
    assert.ok(descMatch[1].length > 10, `${file}: description too short`);
  }
});

test('each command references skill-guide.js', () => {
  const commandsDir = path.join(root, 'commands');
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    assert.match(content, /skill-guide\.js/, `${file}: must reference skill-guide.js`);
  }
});
