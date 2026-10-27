import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
