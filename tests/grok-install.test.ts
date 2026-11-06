import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { editPluginList, grokPaths, grokRules, installGrok, pluginListed, uninstallGrok } from '../src/core/grok.js';
import { detectHosts } from '../src/core/hosts.js';

async function grokHome(files: Record<string, string>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sogrok-'));
  for (const [rel, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), text);
  }
  return dir;
}

test('install copies the plugin, enables it and adds the rules, keeping the user config; uninstall undoes it', async () => {
  const toml = '# mine\nmodel = "grok-4.7"\n\n[plugins]\nenabled = ["other"] # keep\n\n[ui]\ntheme = "dark"\n';
  const dir = await grokHome({ 'config.toml': toml, 'AGENTS.md': '# My rules\nBe concise.\n' });
  const paths = grokPaths(dir);
  try {
    await installGrok({ hasCli: true }, paths);
    const second = await installGrok({ hasCli: true }, paths);
    assert.deepEqual(second.warnings, []);
    assert.ok(!second.actions.some((a) => a.includes('enabled') || a.includes('rules')), second.actions.join('\n'));

    for (const part of ['.claude-plugin/plugin.json', 'hooks/hooks.json', 'adapters/claude-code/hooks/stop-gate.mjs', 'skills/senior-debugging/SKILL.md']) {
      assert.ok(existsSync(path.join(paths.plugin, part)), part);
    }
    const config = await readFile(paths.config, 'utf8');
    assert.match(config, /^enabled = \["other", "senioros"\] # keep$/m);
    assert.match(config, /\[ui\]\ntheme = "dark"/);
    assert.equal(await readFile(`${paths.config}.bak-senioros`, 'utf8'), toml);
    const agents = await readFile(paths.agents, 'utf8');
    assert.ok(agents.startsWith('# My rules'));
    assert.equal(agents.split('<!-- senioros:start -->').length, 2, 'one rules block after two installs');
    assert.match(agents, /\*\*Routing:\*\*/);
    assert.match(agents, /Load at most one per task/);

    const host = detectHosts(dir, { home: dir, env: { PATH: '', SENIOROS_GROK_HOME: dir }, root: dir }).find((h) => h.id === 'grok');
    assert.equal(host?.plugin.state, 'yes', host?.plugin.evidence);
    assert.equal(host?.hooks?.state, 'yes');
    assert.deepEqual(host?.steps, []);

    await uninstallGrok(paths);
    assert.ok(!existsSync(paths.plugin));
    assert.match(await readFile(paths.config, 'utf8'), /^enabled = \["other"\] # keep$/m);
    assert.equal(await readFile(paths.agents, 'utf8'), '# My rules\nBe concise.\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('install keeps a plugin folder and rules it did not write, unless --force', async () => {
  const dir = await grokHome({ 'plugins/senioros/mine.txt': 'hand-made', 'AGENTS.md': 'SeniorOS rules pasted by hand\n' });
  const paths = grokPaths(dir);
  try {
    const report = await installGrok({ hasCli: false }, paths);
    assert.equal(report.warnings.length, 2, report.warnings.join('\n'));
    assert.equal(await readFile(path.join(paths.plugin, 'mine.txt'), 'utf8'), 'hand-made');
    assert.equal(await readFile(paths.agents, 'utf8'), 'SeniorOS rules pasted by hand\n');
    assert.match(await readFile(paths.config, 'utf8'), /^enabled = \["senioros"\]$/m, 'a missing config.toml is created');

    await uninstallGrok(paths);
    assert.ok(existsSync(path.join(paths.plugin, 'mine.txt')), 'uninstall leaves a folder it did not create');

    await installGrok({ force: true, hasCli: false }, paths);
    assert.ok(!existsSync(path.join(paths.plugin, 'mine.txt')));
    assert.match(await readFile(paths.agents, 'utf8'), /<!-- senioros:start -->/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the plugin list edit covers the layouts it can edit safely and refuses the others', () => {
  assert.equal(editPluginList('', true), '[plugins]\nenabled = ["senioros"]\n');
  assert.equal(editPluginList('a = 1\n', true), 'a = 1\n\n[plugins]\nenabled = ["senioros"]\n');
  assert.equal(editPluginList('[plugins]\nauto = true\n', true), '[plugins]\nenabled = ["senioros"]\nauto = true\n');
  assert.equal(editPluginList("[plugins]\nenabled = ['senioros']\n", true), "[plugins]\nenabled = ['senioros']\n", 'already there');
  assert.equal(editPluginList('[plugins]\nenabled = ["senioros"]\n', false), '[plugins]\nenabled = []\n');
  assert.equal(editPluginList('[other]\nenabled = ["x"]\n', true), '[other]\nenabled = ["x"]\n\n[plugins]\nenabled = ["senioros"]\n', 'another table\'s enabled is not touched');
  assert.throws(() => editPluginList('[plugins]\nenabled = [\n  "a",\n]\n', true), /several lines/);
  assert.throws(() => editPluginList('plugins.enabled = ["a"]\n', true), /dotted/);
  assert.throws(() => editPluginList('plugins = { enabled = ["a"] }\n', true), /inline table/);
  // Windows line endings and a comment with brackets are kept as written, and so are single quotes.
  assert.equal(editPluginList("[plugins]\r\nenabled = ['a'] # see [docs]\r\n", true), "[plugins]\r\nenabled = ['a', \"senioros\"] # see [docs]\r\n");
  assert.equal(editPluginList('x = 1\r\n', true), 'x = 1\r\n\r\n[plugins]\r\nenabled = ["senioros"]\r\n');
  assert.equal(pluginListed('[mcp]\nenabled = ["senioros"]\n'), false, 'only the [plugins] list counts');
  assert.equal(pluginListed("[plugins]\nenabled = ['x', 'senioros']\n"), true);
});

test('rules markers that do not pair up are left alone; uninstall removes the files the install created', async () => {
  const dir = await grokHome({ 'AGENTS.md': '# Mine\n<!-- senioros:start -->\nold rules, end marker deleted\n# More of mine\n' });
  const paths = grokPaths(dir);
  try {
    const report = await installGrok({ hasCli: false }, paths);
    assert.ok(report.warnings.some((w) => /do not pair up/.test(w)), report.warnings.join('\n'));
    assert.equal(await readFile(paths.agents, 'utf8'), '# Mine\n<!-- senioros:start -->\nold rules, end marker deleted\n# More of mine\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const fresh = await grokHome({});
  const p = grokPaths(fresh);
  try {
    await installGrok({ hasCli: false }, p);
    await uninstallGrok(p);
    assert.ok(!existsSync(p.config), 'config.toml the install created is removed');
    assert.ok(!existsSync(p.agents), 'AGENTS.md the install created is removed');
  } finally {
    await rm(fresh, { recursive: true, force: true });
  }
});

test('the rules drop the CLI line when senior is not installed', () => {
  const rules = '## SeniorOS\n\n- **Routing:** x\n\nIf the `senior` CLI is on PATH: `senior risk`';
  assert.ok(grokRules(rules, true).includes('senior risk'));
  assert.ok(!grokRules(rules, false).includes('senior risk'));
});
