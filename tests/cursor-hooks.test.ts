import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const hooksDir = path.join(root, 'adapters', 'cursor', 'hooks');
const { decide: guard } = (await import(pathToFileURL(path.join(hooksDir, 'guard.mjs')).href)) as {
  decide: (raw: string) => { permission: string; user_message?: string; agent_message?: string };
};
const hooksJson = JSON.parse(readFileSync(path.join(root, 'adapters', 'cursor', 'hooks.json'), 'utf8')) as {
  version: number;
  hooks: Record<string, Array<{ command: string; timeout?: number; loop_limit?: number }>>;
};

// Without NODE_TEST_CONTEXT, which turns a nested `node --test` into a reporting child that always exits 0.
const { NODE_TEST_CONTEXT: _parent, ...baseEnv } = process.env;

/** Runs a hooks.json command the way Cursor does: through the shell, from a folder that is not the plugin root. */
function runHook(event: string, input: object, cwd: string, extraEnv: Record<string, string> = {}) {
  const r = spawnSync(hooksJson.hooks[event]?.[0]?.command ?? '', {
    shell: true, cwd, input: JSON.stringify(input), encoding: 'utf8', timeout: 240_000,
    env: { ...baseEnv, CURSOR_PLUGIN_ROOT: root, ...extraEnv }
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout) as Record<string, string>;
}

test('Cursor guard asks before destructive commands and answers allow otherwise', () => {
  for (const command of ['git push --force origin main', 'git reset --hard HEAD~1', 'rm -rf src', 'cd app && git clean -fdX']) {
    const out = guard(JSON.stringify({ command, cwd: '/w' }));
    assert.equal(out.permission, 'ask', command);
    assert.match(out.agent_message ?? '', /SeniorOS guard/);
  }
  for (const command of ['git status', 'npm test', 'rm -rf node_modules']) assert.equal(guard(JSON.stringify({ command })).permission, 'allow', command);
  // Cursor blocks on invalid output, so a broken payload still gets a valid answer.
  assert.equal(guard('not json').permission, 'allow');
});

test('Cursor hooks.json commands load the hooks from the plugin root, whatever the working folder', () => {
  assert.equal(hooksJson.version, 1);
  assert.equal(hooksJson.hooks.stop?.[0]?.loop_limit, 2);
  const elsewhere = mkdtempSync(path.join(os.tmpdir(), 'cur-'));
  try {
    assert.match(runHook('sessionStart', { session_id: 's' }, elsewhere).additional_context ?? '', /Approval boundary/);
    assert.equal(runHook('beforeShellExecution', { command: 'git push -f origin main' }, elsewhere).permission, 'ask');
    assert.equal(runHook('beforeShellExecution', { command: 'git status' }, elsewhere).permission, 'allow');
    // Not a git repository: the gate lets the agent finish.
    assert.deepEqual(runHook('stop', { status: 'completed', conversation_id: 'c', workspace_roots: [elsewhere] }, elsewhere), {});
  } finally {
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

test('Cursor stop gate sends the agent back on failing checks and ignores aborted runs', () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'curs-'));
  const clean = `${repo}-clean`;
  const git = (...args: string[]) => assert.equal(spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).status, 0);
  const cli = { SENIOROS_CLI: `"${process.execPath}" "${path.join(root, 'dist', 'src', 'index.js')}"` };
  try {
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }));
    mkdirSync(path.join(repo, 'test'));
    writeFileSync(path.join(repo, 'test', 'f.test.js'), "import t from 'node:test'; import a from 'node:assert/strict'; import { f } from '../f.js'; t('f', () => a.equal(f(), 1));\n");
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 1;\n');
    git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('add', '-A'); git('commit', '-q', '-m', 'init');
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 2;\n');

    const input = { conversation_id: `c${process.pid}`, workspace_roots: [repo] };
    assert.deepEqual(runHook('stop', { ...input, status: 'aborted' }, repo, cli), {}, 'an aborted run is not a claim of done');
    assert.match(runHook('stop', { ...input, status: 'completed' }, repo, cli).followup_message ?? '', /SeniorOS finish gate/);

    // Multi-root workspace: a clean repository first must not hide the failing one, and two folders of the same
    // repository are checked once.
    const gitIn = (cwd: string, ...args: string[]) => assert.equal(spawnSync('git', args, { cwd, encoding: 'utf8' }).status, 0);
    mkdirSync(clean);
    writeFileSync(path.join(clean, 'package.json'), '{}');
    gitIn(clean, 'init', '-q', '-b', 'main'); gitIn(clean, 'config', 'user.email', 't@t'); gitIn(clean, 'config', 'user.name', 't');
    gitIn(clean, 'add', '-A'); gitIn(clean, 'commit', '-q', '-m', 'init');
    const multi = { conversation_id: `m${process.pid}`, status: 'completed', workspace_roots: [clean, repo, path.join(repo, 'test')] };
    const message = runHook('stop', multi, clean, cli).followup_message ?? '';
    assert.equal(message.match(/SeniorOS finish gate/g)?.length, 1, message);
    assert.match(message, /^Repository /);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(clean, { recursive: true, force: true });
  }
});
