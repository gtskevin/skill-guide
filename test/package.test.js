'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('npm tarball includes runtime modules and installed CLI starts', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-package-'));
  const packDir = path.join(temp, 'pack');
  const installDir = path.join(temp, 'install');
  const home = path.join(temp, 'home');
  fs.mkdirSync(packDir, { recursive: true });
  fs.mkdirSync(home, { recursive: true });

  const packOutput = execFileSync('npm', ['pack', '--json', '--pack-destination', packDir], {
    cwd: root,
    encoding: 'utf8',
  });
  const [{ filename, files }] = JSON.parse(packOutput);
  assert.ok(files.some((file) => file.path === 'skill-registry.js'), 'tarball should include skill-registry.js');

  const tarball = path.join(packDir, filename);
  execFileSync('npm', ['install', '--prefix', installDir, tarball], {
    cwd: root,
    encoding: 'utf8',
  });

  const installedCli = path.join(installDir, 'node_modules', 'skill-guide', 'skill-guide.js');
  const stdout = execFileSync(process.execPath, [installedCli, '--doctor', '--refresh'], {
    cwd: installDir,
    env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') },
    encoding: 'utf8',
  });

  assert.match(stdout, /Skill Guide Doctor/);
});
