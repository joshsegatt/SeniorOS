import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const CLI = path.resolve(here, '../src/index.js');

async function json(relative: string): Promise<Record<string, any>> {
  return JSON.parse(await readFile(path.join(repo, relative), 'utf8')) as Record<string, any>;
}

test('package, CLI and plugin manifests declare the same version', async () => {
  const { version } = await json('package.json');
  const cli = spawnSync(process.execPath, [CLI, '--version'], { encoding: 'utf8' }).stdout.trim();
  const claude = await json('.claude-plugin/plugin.json');
  const marketplace = await json('.claude-plugin/marketplace.json');
  const codex = await json('.codex-plugin/plugin.json');
  const cursor = await json('.cursor-plugin/plugin.json');

  assert.equal(cli, version);
  assert.equal(claude.version, version);
  assert.equal(marketplace.plugins[0].version, version);
  assert.equal(codex.version, version);
  assert.equal(cursor.version, version);
});

test('plugin manifests point at the shipped skills and the real repository', async () => {
  const codex = await json('.codex-plugin/plugin.json');
  const claude = await json('.claude-plugin/plugin.json');
  const { repository } = await json('package.json');

  assert.equal(codex.skills, './skills/');
  const cursor = await json('.cursor-plugin/plugin.json');
  assert.equal(cursor.skills, './skills/');
  assert.equal(cursor.hooks, './adapters/cursor/hooks.json');
  // Antigravity reads plugin.json at the root and rejects any key besides $schema, name and description.
  const agy = await json('plugin.json');
  assert.deepEqual(Object.keys(agy).sort(), ['description', 'name']);
  assert.equal(agy.name, 'senioros');
  assert.equal(claude.repository, 'https://github.com/joshsegatt/SeniorOS');
  assert.match(repository.url, /github\.com\/joshsegatt\/SeniorOS\.git$/);
});
