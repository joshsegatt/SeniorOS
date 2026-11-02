import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectHosts, trustedCodexHooks, type HostEnvironment, type HostId, type HostStatus } from '../src/core/hosts.js';
import { setup } from '../src/core/setup.js';

/** A fake home and project, and an environment whose PATH holds only `commands`. */
function machine(commands: string[] = []) {
  const base = mkdtempSync(path.join(os.tmpdir(), 'hosts-'));
  const home = path.join(base, 'home');
  const root = path.join(base, 'project');
  const bin = path.join(base, 'bin');
  for (const dir of [home, root, bin]) mkdirSync(dir, { recursive: true });
  for (const c of commands) writeFileSync(path.join(bin, c), '');
  const e: HostEnvironment = { home, root, env: { PATH: bin } };
  const put = (file: string, text = '') => { mkdirSync(path.dirname(path.join(home, file)), { recursive: true }); writeFileSync(path.join(home, file), text); };
  const host = (id: HostId) => detectHosts(root, e).find((h) => h.id === id) as HostStatus;
  return { base, home, root, e, put, host, done: () => rmSync(base, { recursive: true, force: true }) };
}

test('nothing installed: no host is found, and what cannot be known says unknown', () => {
  const m = machine();
  try {
    const hosts = detectHosts(m.root, m.e);
    assert.deepEqual(hosts.map((h) => h.present.state), ['no', 'no', 'no', 'no', 'no']);
    // No plugin record at all is not proof of absence.
    assert.equal(m.host('claude').plugin.state, 'unknown');
    assert.equal(m.host('codex').plugin.state, 'unknown');
    assert.equal(m.host('cursor').plugin.state, 'unknown');
    assert.equal(m.host('opencode').plugin.state, 'no');
    assert.equal(m.host('antigravity').plugin.state, 'no');
  } finally {
    m.done();
  }
});

test('everything installed: each host shows the evidence and has no step left', () => {
  const m = machine(['claude', 'codex', 'opencode']);
  try {
    m.put('.claude/plugins/installed_plugins.json', JSON.stringify({ version: 2, plugins: { 'senioros@senioros': [{ scope: 'user' }] } }));
    mkdirSync(path.join(m.home, '.codex', 'plugins', 'cache', 'senioros', 'senioros'), { recursive: true });
    const hookKey = (event: string) => `[hooks.state.'${path.join(m.home, '.codex', 'plugins', 'cache', 'senioros', 'senioros', 'hooks.json')}:${event}:0:0']\ntrusted_hash = "sha256:x"\n`;
    m.put('.codex/config.toml', ['session_start', 'pre_tool_use', 'stop'].map(hookKey).join('\n'));
    mkdirSync(path.join(m.home, '.cursor', 'plugins', 'local', 'senioros'), { recursive: true });
    m.put('.config/opencode/opencode.json', JSON.stringify({ plugin: ['senioros@0.8.0'] }));
    mkdirSync(path.join(m.home, '.gemini', 'antigravity'), { recursive: true });
    m.put('.gemini/config/senioros/install.json', '{}');
    m.put('.gemini/config/hooks.json', JSON.stringify({ hooks: [{ command: 'node hooks/senioros/guard.mjs' }] }));

    for (const host of detectHosts(m.root, m.e)) {
      assert.equal(host.present.state, 'yes', host.name);
      assert.equal(host.plugin.state, 'yes', `${host.name}: ${host.plugin.evidence}`);
      assert.deepEqual(host.steps, [], host.name);
    }
    assert.equal(m.host('codex').hooks?.state, 'yes');
    assert.match(m.host('codex').hooks?.evidence ?? '', /3 SeniorOS hooks/);
    assert.equal(m.host('antigravity').hooks?.state, 'yes');
  } finally {
    m.done();
  }
});

test('half-done and unreadable setups are reported as such, with the step that is left', () => {
  const m = machine(['claude', 'codex']);
  try {
    // A plugin turned off in Claude Code settings is not set up.
    m.put('.claude/plugins/installed_plugins.json', JSON.stringify({ plugins: { 'senioros@senioros': [{}] } }));
    m.put('.claude/settings.json', JSON.stringify({ enabledPlugins: { 'senioros@senioros': false } }));
    assert.equal(m.host('claude').plugin.state, 'no');
    assert.match(m.host('claude').plugin.evidence, /disabled/);

    // A record that cannot be read proves nothing either way.
    m.put('.claude/plugins/installed_plugins.json', '{ not json');
    assert.equal(m.host('claude').plugin.state, 'unknown');

    // Codex plugin installed, hooks not trusted yet.
    mkdirSync(path.join(m.home, '.codex', 'plugins', 'cache', 'senioros', 'senioros'), { recursive: true });
    const codex = m.host('codex');
    assert.equal(codex.plugin.state, 'yes');
    assert.equal(codex.hooks?.state, 'unknown');
    assert.deepEqual(codex.steps, ['In Codex: open /hooks and trust the three SeniorOS hooks']);
    // Another plugin in the cache is not SeniorOS.
    rmSync(path.join(m.home, '.codex', 'plugins', 'cache', 'senioros'), { recursive: true });
    mkdirSync(path.join(m.home, '.codex', 'plugins', 'cache', 'openai', 'github'), { recursive: true });
    assert.equal(m.host('codex').plugin.state, 'no');

    // OpenCode: a file that does not parse is unknown, not "not installed".
    m.put('.config/opencode/opencode.json', '{ "plugin": [');
    assert.equal(m.host('opencode').plugin.state, 'unknown');

    // Antigravity skills registered by hand, without the hooks: the guard is not there.
    mkdirSync(path.join(m.home, '.gemini', 'antigravity'), { recursive: true });
    m.put('.gemini/config/skills.json', JSON.stringify({ entries: [{ path: '~/code/SeniorOS/skills' }] }));
    const agy = m.host('antigravity');
    assert.equal(agy.plugin.state, 'yes');
    assert.equal(agy.hooks?.state, 'no');
    assert.equal(agy.steps.length, 1);
  } finally {
    m.done();
  }
});

test('review findings: hook trust, project-scope installs and configs setup cannot rewrite', async () => {
  const m = machine(['claude', 'codex', 'opencode']);
  try {
    // Codex: one of three hooks trusted is not trusted; double-quoted keys and other keys first still count.
    mkdirSync(path.join(m.home, '.codex', 'plugins', 'cache', 'senioros', 'senioros'), { recursive: true });
    m.put('.codex/config.toml', `[hooks.state.'C:/x/senioros/hooks.json:stop:0:0']\ntrusted_hash = "a"\n`);
    assert.equal(m.host('codex').hooks?.state, 'no');
    assert.match(m.host('codex').hooks?.evidence ?? '', /1 of the 3/);
    assert.equal(trustedCodexHooks([
      `[hooks.state."C:\\\\x\\\\senioros\\\\hooks.json:stop:0:0"]`, 'enabled = true', 'trusted_hash = "a"',
      `[hooks.state.'/x/senioros/hooks.json:pre:0:0']`, 'trusted_hash = "b"',
      `[hooks.state.'/x/other/hooks.json:pre:0:0']`, 'trusted_hash = "c"',
      `[mcp_servers.senioros]`, 'trusted_hash = "d"',
    ].join('\n')), 2);

    // Claude: a project-scope install for another repository does not load here.
    m.put('.claude/plugins/installed_plugins.json', JSON.stringify({ plugins: { 'senioros@senioros': [{ scope: 'project', projectPath: path.join(m.base, 'other') }] } }));
    assert.equal(m.host('claude').plugin.state, 'no');
    assert.match(m.host('claude').plugin.evidence, /another project/);
    m.put('.claude/plugins/installed_plugins.json', JSON.stringify({ plugins: { 'senioros@senioros': [{ scope: 'project', projectPath: m.root }] } }));
    assert.equal(m.host('claude').plugin.state, 'yes');

    // OpenCode: valid JSON that is not an object is never rewritten, and the step says so.
    for (const text of ['null', '[]', '{ "plugin": "senioros-old" }']) {
      m.put('.config/opencode/opencode.json', text);
      assert.doesNotMatch(m.host('opencode').steps.join(' '), /setup --apply does it/, text);
      const report = await setup(m.root, { apply: true }, m.e);
      assert.deepEqual(report.applied.filter((a) => a.startsWith('OpenCode')), [], text);
      assert.equal(readFileSync(path.join(m.home, '.config', 'opencode', 'opencode.json'), 'utf8'), text);
    }
  } finally {
    m.done();
  }
});

test('setup without --apply changes nothing; with it, adds the OpenCode plugin and keeps the user config', async () => {
  const m = machine(['opencode']);
  const file = path.join(m.home, '.config', 'opencode', 'opencode.json');
  try {
    const dry = await setup(m.root, {}, m.e);
    assert.deepEqual(dry.applied, []);
    assert.equal(existsSync(file), false);

    m.put('.config/opencode/opencode.json', JSON.stringify({ model: 'x', plugin: ['other'] }, null, 2));
    const applied = await setup(m.root, { apply: true }, m.e);
    assert.equal(applied.applied.length, 1, applied.skipped.join('\n'));
    const data = JSON.parse(readFileSync(file, 'utf8')) as { model: string; plugin: string[] };
    assert.equal(data.model, 'x');
    assert.deepEqual(data.plugin, ['other', 'senioros']);
    assert.ok(existsSync(`${file}.bak-senioros`), 'the original is backed up');
    assert.equal(applied.hosts.find((h) => h.id === 'opencode')?.plugin.state, 'yes');

    // Running it again adds nothing.
    assert.deepEqual((await setup(m.root, { apply: true }, m.e)).applied, []);
  } finally {
    m.done();
  }
});

test('setup --apply runs the Antigravity installer when Antigravity is here without SeniorOS', async () => {
  const m = machine();
  try {
    mkdirSync(path.join(m.home, '.gemini', 'antigravity'), { recursive: true });
    assert.equal(m.host('antigravity').plugin.state, 'no');
    const report = await setup(m.root, { apply: true }, m.e);
    assert.ok(report.applied.some((a) => /^Antigravity: /.test(a)), report.applied.join('\n'));
    const agy = report.hosts.find((h) => h.id === 'antigravity');
    assert.equal(agy?.plugin.state, 'yes');
    assert.equal(agy?.hooks?.state, 'yes');
    assert.deepEqual(agy?.steps, []);
  } finally {
    m.done();
  }
});

test('setup --apply leaves a config it cannot rewrite safely, and hosts that are not here', async () => {
  const m = machine(['opencode']);
  try {
    m.put('.config/opencode/opencode.jsonc', '// mine\n{ "plugin": [] }\n');
    const report = await setup(m.root, { apply: true }, m.e);
    assert.deepEqual(report.applied, []);
    assert.match(report.skipped.join('\n'), /JSONC/);
    assert.equal(readFileSync(path.join(m.home, '.config', 'opencode', 'opencode.jsonc'), 'utf8'), '// mine\n{ "plugin": [] }\n');
    // Antigravity is not on this machine, so its installer does not run.
    assert.equal(existsSync(path.join(m.home, '.gemini')), false);
  } finally {
    m.done();
  }
});
