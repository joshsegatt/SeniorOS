import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
type Hooks = {
  config: (c: Record<string, any>) => Promise<void>;
  'experimental.chat.system.transform': (i: object, o: { system: string[] }) => Promise<void>;
  'tool.execute.before': (i: { tool: string }, o: { args: Record<string, unknown> }) => Promise<void>;
  event: (e: { event: { type: string; properties?: { sessionID?: string } } }) => Promise<void>;
};
const mod = (await import(pathToFileURL(path.join(root, 'adapters', 'opencode', 'plugin.mjs')).href)) as {
  default: { id: string; server: (ctx: object) => Promise<Hooks> };
  SeniorOSPlugin: (ctx: object) => Promise<Hooks>;
  addSkills: (c: Record<string, any>) => void;
};

// Without NODE_TEST_CONTEXT, which turns a nested `node --test` into a reporting child that always exits 0.
const { NODE_TEST_CONTEXT: _parent, ...baseEnv } = process.env;

/** A stand-in for OpenCode's SDK client that records the prompts the plugin sends. */
function fakeClient(parentID?: string) {
  const prompts: Array<{ id: string; text: string }> = [];
  return {
    prompts,
    session: {
      get: async ({ path: p }: { path: { id: string } }) => ({ data: { id: p.id, parentID } }),
      promptAsync: async ({ path: p, body }: { path: { id: string }; body: { parts: Array<{ text: string }> } }) => {
        prompts.push({ id: p.id, text: body.parts[0]?.text ?? '' });
      }
    }
  };
}

test('the npm package main is the OpenCode plugin, with V1 named and default exports', async () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { main: string; files: string[] };
  assert.equal(pkg.main, 'adapters/opencode/plugin.mjs');
  assert.ok(pkg.files.includes('adapters') && pkg.files.includes('skills'));
  assert.equal(mod.default.id, 'senioros');
  assert.equal(mod.default.server, mod.SeniorOSPlugin);
});

test('OpenCode plugin registers the skills and adds the rules once', async () => {
  const hooks = await mod.SeniorOSPlugin({ client: fakeClient(), directory: root });
  const skills = path.join(root, 'skills');
  const legacy: Record<string, any> = {};
  await hooks.config(legacy);
  await hooks.config(legacy);
  assert.deepEqual(legacy.skills.paths, [skills]);
  const flat: Record<string, any> = { skills: ['/other'] };
  mod.addSkills(flat);
  assert.deepEqual(flat.skills, ['/other', skills]);

  const out = { system: ['base'] };
  await hooks['experimental.chat.system.transform']({}, out);
  await hooks['experimental.chat.system.transform']({}, out);
  assert.equal(out.system.length, 2);
  assert.match(out.system[1] ?? '', /Approval boundary/);
});

test('OpenCode guard fails destructive bash calls and lets the rest through', async () => {
  const hooks = await mod.SeniorOSPlugin({ client: fakeClient(), directory: root });
  for (const command of ['git push --force origin main', 'git reset --hard HEAD', 'rm -rf src', 'cd app && git clean -fdX']) {
    await assert.rejects(hooks['tool.execute.before']({ tool: 'bash' }, { args: { command } }), /SeniorOS guard: .*run it themselves/, command);
  }
  for (const command of ['git status', 'npm test', 'rm -rf node_modules']) await hooks['tool.execute.before']({ tool: 'bash' }, { args: { command } });
  await hooks['tool.execute.before']({ tool: 'read' }, { args: { filePath: 'x' } });
});

test('OpenCode finish gate sends the session back on failing checks, not subagents', async () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'ocs-'));
  const git = (...args: string[]) => assert.equal(spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).status, 0);
  const saved = { ...process.env };
  try {
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }));
    mkdirSync(path.join(repo, 'test'));
    writeFileSync(path.join(repo, 'test', 'f.test.js'), "import t from 'node:test'; import a from 'node:assert/strict'; import { f } from '../f.js'; t('f', () => a.equal(f(), 1));\n");
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 1;\n');
    git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('add', '-A'); git('commit', '-q', '-m', 'init');
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 2;\n');

    // The gate runs in a child process that inherits this environment.
    delete process.env.NODE_TEST_CONTEXT;
    Object.assign(process.env, baseEnv, { SENIOROS_CLI: `"${process.execPath}" "${path.join(root, 'dist', 'src', 'index.js')}"` });

    const child = fakeClient('parent');
    await (await mod.SeniorOSPlugin({ client: child, directory: repo })).event({ event: { type: 'session.idle', properties: { sessionID: `sub${process.pid}` } } });
    assert.equal(child.prompts.length, 0, 'a subagent session is not gated');

    const top = fakeClient();
    const hooks = await mod.SeniorOSPlugin({ client: top, directory: repo });
    await hooks.event({ event: { type: 'session.updated' } });
    await hooks.event({ event: { type: 'session.idle', properties: { sessionID: `top${process.pid}` } } });
    assert.equal(top.prompts.length, 1);
    assert.equal(top.prompts[0]?.id, `top${process.pid}`);
    assert.match(top.prompts[0]?.text ?? '', /SeniorOS finish gate/);
  } finally {
    process.env = saved;
    rmSync(repo, { recursive: true, force: true });
  }
});
