import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { antigravityPaths, installAntigravity, uninstallAntigravity } from '../src/core/antigravity.js';

async function geminiHome(files: Record<string, string>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sog-'));
  for (const [rel, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), text);
  }
  return dir;
}

const json = async (file: string) => JSON.parse(await readFile(file, 'utf8'));

test('install adds skills, rules and hooks, keeps the user config, and uninstall restores it', async () => {
  const dir = await geminiHome({
    'GEMINI.md': '# My rules\nBe concise.\n',
    'config/skills.json': JSON.stringify({ entries: [{ path: '~/other-skills' }] }),
    'config/hooks.json': JSON.stringify({ 'my-hook': { Stop: [{ type: 'command', command: 'node mine.mjs' }] } })
  });
  const paths = antigravityPaths(dir);
  try {
    await installAntigravity({}, paths);
    await installAntigravity({ turbo: true }, paths);

    const skills = await json(paths.skillsJson);
    assert.equal(skills.entries.length, 2, 'reinstalling does not add a second entry');
    assert.equal(skills.entries[0].path, '~/other-skills');
    const hooks = await json(paths.hooksJson);
    assert.ok(hooks['my-hook'], 'the user hook is kept');
    assert.match(JSON.stringify(hooks['senioros-guard']), /--passthrough=allow/);
    const rules = await readFile(paths.rules, 'utf8');
    assert.ok(rules.startsWith('# My rules'));
    assert.equal(rules.split('<!-- senioros:start -->').length, 2, 'one rules block after two installs');
    await readFile(path.join(paths.skills, 'senior-engineering', 'SKILL.md'));
    await readFile(path.join(paths.hooks, 'guard.mjs'));

    await uninstallAntigravity(paths);
    assert.deepEqual(await json(paths.skillsJson), { entries: [{ path: '~/other-skills' }] });
    assert.deepEqual(Object.keys(await json(paths.hooksJson)), ['my-hook']);
    assert.equal(await readFile(paths.rules, 'utf8'), '# My rules\nBe concise.\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('install does not duplicate a SeniorOS setup made by hand', async () => {
  const dir = await geminiHome({ 'GEMINI.md': '## 7. SeniorOS harness\nmanual rules\n' });
  const paths = antigravityPaths(dir);
  const clone = path.join(dir, 'clone-skills');
  await mkdir(path.join(clone, 'senior-engineering'), { recursive: true });
  await writeFile(path.join(clone, 'senior-engineering', 'SKILL.md'), '---\nname: senior-engineering\n---\n');
  await mkdir(paths.config, { recursive: true });
  await writeFile(paths.skillsJson, JSON.stringify({ entries: [{ path: clone }] }));
  try {
    const report = await installAntigravity({}, paths);
    assert.deepEqual((await json(paths.skillsJson)).entries, [{ path: clone }]);
    assert.equal(await readFile(paths.rules, 'utf8'), '## 7. SeniorOS harness\nmanual rules\n');
    assert.equal(report.warnings.length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reinstall keeps a customized skill and preserves a disabled hook, unless --force', async () => {
  const dir = await geminiHome({});
  const paths = antigravityPaths(dir);
  try {
    await installAntigravity({}, paths);
    const skill = path.join(paths.skills, 'senior-engineering', 'SKILL.md');
    await writeFile(skill, 'my customized skill');
    const hooks = await json(paths.hooksJson);
    hooks['senioros-finish-gate'].enabled = false;
    await writeFile(paths.hooksJson, JSON.stringify(hooks));

    const report = await installAntigravity({}, paths);
    assert.equal(await readFile(skill, 'utf8'), 'my customized skill');
    assert.ok(report.warnings.some((w) => w.includes(paths.skills)));
    assert.equal((await json(paths.hooksJson))['senioros-finish-gate'].enabled, false, 'the user switch survives a reinstall');

    await installAntigravity({ force: true }, paths);
    assert.notEqual(await readFile(skill, 'utf8'), 'my customized skill');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('hand-made hooks are kept, and a --force install is undone by uninstall', async () => {
  const manualGuard = { PreToolUse: [{ matcher: 'run_command', hooks: [{ type: 'command', command: 'node hooks/senioros/guard.mjs --passthrough=allow', timeout: 30 }] }] };
  const dir = await geminiHome({
    'config/hooks.json': JSON.stringify({ 'senioros-guard': manualGuard }),
    'config/hooks/senioros/guard.mjs': '// my own guard\n'
  });
  const paths = antigravityPaths(dir);
  try {
    const report = await installAntigravity({}, paths);
    const hooks = await json(paths.hooksJson);
    assert.deepEqual(hooks['senioros-guard'], manualGuard, 'a block the installer did not write is kept');
    assert.ok(hooks['senioros-context'], 'missing blocks are added');
    assert.equal(await readFile(path.join(paths.hooks, 'guard.mjs'), 'utf8'), '// my own guard\n');
    assert.equal(report.warnings.length, 2);

    await uninstallAntigravity(paths);
    assert.deepEqual(await json(paths.hooksJson), { 'senioros-guard': manualGuard }, 'uninstall removes only what it added');
    assert.equal(await readFile(path.join(paths.hooks, 'guard.mjs'), 'utf8'), '// my own guard\n');

    await installAntigravity({ force: true }, paths);
    assert.notDeepEqual((await json(paths.hooksJson))['senioros-guard'], manualGuard);
    await uninstallAntigravity(paths);
    assert.deepEqual(await json(paths.hooksJson), { 'senioros-guard': manualGuard }, 'the replaced block is restored');
    assert.equal(await readFile(path.join(paths.hooks, 'guard.mjs'), 'utf8'), '// my own guard\n', 'the replaced scripts are restored');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('rules markers that do not pair up are left alone, on install and uninstall', async () => {
  const broken = '# Mine\n<!-- senioros:start -->\nold rules, end marker deleted\n# More of mine\n';
  const dir = await geminiHome({ 'GEMINI.md': broken });
  const paths = antigravityPaths(dir);
  try {
    const report = await installAntigravity({}, paths);
    assert.ok(report.warnings.some((w) => /do not pair up/.test(w)), report.warnings.join('\n'));
    assert.equal(await readFile(paths.rules, 'utf8'), broken);
    const removed = await uninstallAntigravity(paths);
    assert.ok(removed.warnings.some((w) => /do not pair up/.test(w)), removed.warnings.join('\n'));
    assert.equal(await readFile(paths.rules, 'utf8'), broken);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('uninstall removes a GEMINI.md the install created and left empty', async () => {
  const dir = await geminiHome({});
  const paths = antigravityPaths(dir);
  try {
    await installAntigravity({}, paths);
    await uninstallAntigravity(paths);
    assert.ok(!existsSync(paths.rules));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reinstall keeps an edited hook script and the hook log, unless --force, which backs the edit up', async () => {
  const dir = await geminiHome({});
  const paths = antigravityPaths(dir);
  try {
    await installAntigravity({}, paths);
    const guard = path.join(paths.hooks, 'guard.mjs');
    const shipped = await readFile(guard, 'utf8');
    await writeFile(guard, '// my edited guard');
    await writeFile(path.join(paths.hooks, 'hooks.log'), 'a log line\n');

    const report = await installAntigravity({}, paths);
    assert.equal(await readFile(guard, 'utf8'), '// my edited guard');
    assert.ok(report.warnings.some((w) => w.includes('guard.mjs')), 'the user is told why the scripts were not updated');

    await installAntigravity({ force: true }, paths);
    assert.equal(await readFile(guard, 'utf8'), shipped);
    assert.equal(await readFile(path.join(`${paths.hooks}.bak-senioros`, 'guard.mjs'), 'utf8'), '// my edited guard');
    assert.equal(await readFile(path.join(paths.hooks, 'hooks.log'), 'utf8'), 'a log line\n', 'the log stays');

    const again = await installAntigravity({}, paths);
    assert.deepEqual(again.warnings.filter((w) => w.includes('hook scripts')), [], 'an untouched reinstall updates quietly');

    await uninstallAntigravity(paths);
    assert.equal(await readFile(guard, 'utf8'), '// my edited guard', 'uninstall puts the edited script back');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a deleted hook script stays deleted, and its hooks.json blocks are not updated either', async () => {
  const dir = await geminiHome({});
  const paths = antigravityPaths(dir);
  try {
    await installAntigravity({}, paths);
    await rm(path.join(paths.hooks, 'track.mjs'));
    const before = await readFile(paths.hooksJson, 'utf8');
    const report = await installAntigravity({ turbo: true }, paths);
    assert.equal(existsSync(path.join(paths.hooks, 'track.mjs')), false);
    assert.ok(report.warnings.some((w) => w.includes('track.mjs')));
    assert.equal(await readFile(paths.hooksJson, 'utf8'), before, 'the blocks stay as they were');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('an install from before script hashes is upgraded after a backup of its scripts', async () => {
  const dir = await geminiHome({});
  const paths = antigravityPaths(dir);
  try {
    await installAntigravity({}, paths);
    const manifestPath = path.join(paths.home, 'install.json');
    const manifest = await json(manifestPath);
    delete manifest.hookFiles;
    await writeFile(manifestPath, JSON.stringify(manifest));
    await writeFile(path.join(paths.hooks, 'guard.mjs'), '// edited before 0.10.2');
    await writeFile(path.join(paths.hooks, 'old-script.mjs'), '// shipped by an older version');

    const report = await installAntigravity({}, paths);
    assert.deepEqual(report.warnings, []);
    assert.notEqual(await readFile(path.join(paths.hooks, 'guard.mjs'), 'utf8'), '// edited before 0.10.2');
    assert.equal(existsSync(path.join(paths.hooks, 'old-script.mjs')), false);
    assert.equal(await readFile(path.join(`${paths.hooks}.bak-senioros-pre-0.10.2`, 'guard.mjs'), 'utf8'), '// edited before 0.10.2');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('an invalid hooks.json stops the first install before anything is copied', async () => {
  const dir = await geminiHome({ 'config/hooks.json': '{ "mine": {}, }' });
  const paths = antigravityPaths(dir);
  try {
    await assert.rejects(installAntigravity({}, paths), /not valid JSON/);
    assert.equal(existsSync(paths.skills), false);
    assert.equal(existsSync(paths.hooks), false);

    await writeFile(paths.hooksJson, '{ "mine": {} }');
    const report = await installAntigravity({}, paths);
    assert.deepEqual(report.warnings, [], 'after the fix, the install runs as a first install');
    assert.ok((await json(paths.hooksJson)).mine, 'the user block stays');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
