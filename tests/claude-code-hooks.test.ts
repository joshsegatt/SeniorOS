import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const hooksDir = path.join(process.cwd(), 'adapters', 'claude-code', 'hooks');
const { decide } = (await import(pathToFileURL(path.join(hooksDir, 'pretool-guard.mjs')).href)) as {
  decide: (raw: string) => { hookSpecificOutput: { permissionDecision: string } } | null;
};

const bash = (command: string) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

test('Claude Code guard asks before destructive commands and stays silent otherwise', () => {
  for (const command of ['git push --force origin main', 'git reset --hard HEAD~1', 'git checkout -- .', 'rm -rf dist /home/u/project']) {
    assert.equal(decide(bash(command))?.hookSpecificOutput.permissionDecision, 'ask', command);
  }
  for (const command of ['git status', 'npm test', 'rm -rf node_modules']) assert.equal(decide(bash(command)), null, command);
  assert.equal(decide('not json'), null);
});

test('Claude Code guard runs as a hook without triggering the Antigravity guard it imports', () => {
  const r = spawnSync(process.execPath, [path.join(hooksDir, 'pretool-guard.mjs')], { input: bash('git status'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
});

test('Claude Code session start injects the SeniorOS routing rules', () => {
  const r = spawnSync(process.execPath, [path.join(hooksDir, 'session-start.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /senior-engineering/);
  assert.match(out.hookSpecificOutput.additionalContext, /Approval boundary/);
});

test('Claude Code stop gate blocks a finish with failing checks, at most twice, and lets a fixed change through', () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'sog-'));
  const git = (...args: string[]) => assert.equal(spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).status, 0);
  // Without NODE_TEST_CONTEXT: inherited from this test run, it turns the project's own `node --test` into a reporting
  // child that always exits 0, so the gate would see passing checks.
  const { NODE_TEST_CONTEXT: _parent, ...base } = process.env;
  const env = { ...base, SENIOROS_CLI: `"${process.execPath}" "${path.join(process.cwd(), 'dist', 'src', 'index.js')}"` };
  const stop = () => {
    const r = spawnSync(process.execPath, [path.join(hooksDir, 'stop-gate.mjs')], {
      input: JSON.stringify({ cwd: repo, session_id: `t${process.pid}` }), encoding: 'utf8', env, timeout: 240_000
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout ? (JSON.parse(r.stdout) as { decision: string; reason: string }) : null;
  };
  try {
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }));
    mkdirSync(path.join(repo, 'test'));
    writeFileSync(path.join(repo, 'test', 'f.test.js'), "import t from 'node:test'; import a from 'node:assert/strict'; import { f } from '../f.js'; t('f', () => a.equal(f(), 1));\n");
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 1;\n');
    git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('add', '-A'); git('commit', '-q', '-m', 'init');

    assert.equal(stop(), null, 'no change: the agent may finish');
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 2;\n');
    const blocked = stop();
    assert.equal(blocked?.decision, 'block');
    assert.match(blocked?.reason ?? '', /FAIL test/);
    assert.match(blocked?.reason ?? '', /Fix the root cause.*a change they ruled out/s);
    const again = stop();
    assert.equal(again?.decision, 'block', 'second block for the same change set');
    // An agent sent back twice with the same text edited a test the user had said not to touch.
    assert.match(again?.reason ?? '', /has not changed since this failure was last reported.*repeat that explanation briefly and stop/s);
    assert.equal(stop(), null, 'never more than two blocks for one change set');
    writeFileSync(path.join(repo, 'f.js'), 'export const f = () => 1;\nexport const g = 1;\n');
    assert.equal(stop(), null, 'a passing change set may finish');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
