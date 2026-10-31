import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const hooksDir = path.join(root, 'adapters', 'codex', 'hooks');
type Response = { hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string; additionalContext?: string }; decision?: string; reason?: string };
const { decide: guard } = (await import(pathToFileURL(path.join(hooksDir, 'guard.mjs')).href)) as {
  decide: (raw: string) => Response | null;
};
const hooksJson = JSON.parse(readFileSync(path.join(root, 'adapters', 'codex', 'hooks.json'), 'utf8')) as {
  hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }>>;
};

// Without NODE_TEST_CONTEXT, which turns a nested `node --test` into a reporting child that always exits 0.
const { NODE_TEST_CONTEXT: _parent, ...baseEnv } = process.env;

/** Runs a hooks.json command the way Codex does: through the shell, from the session folder, with PLUGIN_ROOT set. */
function runHook(event: string, input: object, cwd: string, extraEnv: Record<string, string> = {}) {
  const r = spawnSync(hooksJson.hooks[event]?.[0]?.hooks[0]?.command ?? '', {
    shell: true, cwd, input: JSON.stringify(input), encoding: 'utf8', timeout: 240_000,
    env: { ...baseEnv, PLUGIN_ROOT: root, ...extraEnv }
  });
  assert.equal(r.status, 0, r.stderr);
  return (r.stdout.trim() ? JSON.parse(r.stdout) : null) as Response | null;
}

test('Codex guard denies destructive commands and stays silent otherwise', () => {
  for (const command of ['git push --force origin main', 'git reset --hard HEAD', 'rm -rf src', 'cd app && git clean -fdX']) {
    const out = guard(JSON.stringify({ tool_name: 'Bash', tool_input: { command } }));
    // Codex treats "ask" as a hook error and runs the command, so only "deny" stops it.
    assert.equal(out?.hookSpecificOutput?.permissionDecision, 'deny', command);
    assert.match(out?.hookSpecificOutput?.permissionDecisionReason ?? '', /SeniorOS guard: .*run it themselves/);
  }
  assert.equal(guard(JSON.stringify({ tool_input: { command: ['git', 'reset', '--hard'] } }))?.hookSpecificOutput?.permissionDecision, 'deny');
  for (const command of ['git status', 'npm test', 'rm -rf node_modules']) assert.equal(guard(JSON.stringify({ tool_input: { command } })), null, command);
  assert.equal(guard('not json'), null);
});

test('Codex hooks.json commands load the hooks from PLUGIN_ROOT, whatever the working folder', () => {
  assert.equal(hooksJson.hooks.PreToolUse?.[0]?.matcher, '^(Bash|apply_patch|Edit|Write)$');
  for (const groups of Object.values(hooksJson.hooks)) for (const g of groups) for (const h of g.hooks) {
    assert.equal(h.type, 'command');
    assert.doesNotMatch(h.command, /\$/, 'no shell variables: PowerShell and POSIX shells expand them differently');
  }
  const elsewhere = mkdtempSync(path.join(os.tmpdir(), 'cdx-'));
  try {
    assert.match(runHook('SessionStart', { source: 'startup' }, elsewhere)?.hookSpecificOutput?.additionalContext ?? '', /Approval boundary/);
    assert.equal(runHook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'git push -f origin main' } }, elsewhere)?.hookSpecificOutput?.permissionDecision, 'deny');
    assert.equal(runHook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'git status' } }, elsewhere), null);
    // Not a git repository: the gate lets the agent finish, with the empty JSON object Codex expects.
    assert.deepEqual(runHook('Stop', { cwd: elsewhere, session_id: 's', stop_hook_active: false }, elsewhere), {});
  } finally {
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

test('Codex stop gate sends the agent back on failing checks', () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'cdxs-'));
  const git = (...args: string[]) => assert.equal(spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).status, 0);
  const cli = { SENIOROS_CLI: `"${process.execPath}" "${path.join(root, 'dist', 'src', 'index.js')}"` };
  try {
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }));
    mkdirSync(path.join(repo, 'test'));
    writeFileSync(path.join(repo, 'test', 'f.test.js'), "import t from 'node:test'; import a from 'node:assert/strict'; import { f } from '../f.js'; t('f', () => a.equal(f(), 1));\n");
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 1;\n');
    git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('add', '-A'); git('commit', '-q', '-m', 'init');
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 2;\n');

    const out = runHook('Stop', { cwd: repo, session_id: `x${process.pid}`, stop_hook_active: false }, repo, cli);
    assert.equal(out?.decision, 'block');
    assert.match(out?.reason ?? '', /SeniorOS finish gate/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
