import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
// Without NODE_TEST_CONTEXT, which turns a nested `node --test` into a reporting child that always exits 0.
const { NODE_TEST_CONTEXT: _parent, ...baseEnv } = process.env;
const env = { ...baseEnv, SENIOROS_CLI: `"${process.execPath}" "${path.join(root, 'dist', 'src', 'index.js')}"` } as NodeJS.ProcessEnv;

/** A repository with a passing test; `file` is the path the agent then edits. */
function repoWith(file: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rev-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }));
  mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
  writeFileSync(path.join(dir, file), 'export const allowed = (user) => user.role === "admin";\n');
  mkdirSync(path.join(dir, 'test'));
  writeFileSync(path.join(dir, 'test', 'a.test.js'), "import t from 'node:test'; t('ok', () => {});\n");
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['add', '-A'], ['commit', '-q', '-m', 'init']]) {
    assert.equal(spawnSync('git', args, { cwd: dir }).status, 0);
  }
  writeFileSync(path.join(dir, file), 'export const allowed = (user) => user.role === "admin" || user.role === "owner";\n');
  return dir;
}

/** Stops a Claude Code session through the real hook script. */
function claudeStop(dir: string, session: string) {
  const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'claude-code', 'hooks', 'stop-gate.mjs')], {
    input: JSON.stringify({ cwd: dir, session_id: session }), encoding: 'utf8', env, timeout: 240_000,
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? (JSON.parse(r.stdout) as { decision: string; reason: string }) : null;
}

test('a medium-risk change with passing checks goes back once for the senior-finish risk review', () => {
  const dir = repoWith('src/auth/policy.js');
  const session = `rev${process.pid}`;
  try {
    const first = claudeStop(dir, session);
    assert.equal(first?.decision, 'block');
    assert.match(first?.reason ?? '', /checks pass\. This change is medium risk or higher/);
    assert.match(first?.reason ?? '', /two most likely ways it is still wrong/);
    assert.equal(claudeStop(dir, session), null, 'the same change finishes on the next stop');

    // Fixing something the review found is a new change set; it is checked, but not sent back for a second review.
    writeFileSync(path.join(dir, 'src', 'auth', 'policy.js'), 'export const allowed = (user) => ["admin", "owner"].includes(user?.role);\n');
    assert.equal(claudeStop(dir, session), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a low-risk change with passing checks finishes without the review', () => {
  const dir = repoWith('src/format.js');
  try {
    assert.equal(claudeStop(dir, `low${process.pid}`), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Antigravity: a review that waits for a failure in another repository is still asked later (review finding)', () => {
  const a = repoWith('src/auth/policy.js');
  const b = repoWith('src/format.js');
  writeFileSync(path.join(b, 'test', 'a.test.js'), "import t from 'node:test'; import x from 'node:assert'; t('bad', () => x.fail('boom'));\n");
  const log = path.join(os.tmpdir(), `rev2-${process.pid}.log`);
  const conversationId = `agy2${process.pid}`;
  const hook = (script: string, input: object) => {
    const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'antigravity', 'hooks', script)], {
      input: JSON.stringify(input), encoding: 'utf8', env: { ...env, SENIOROS_HOOK_LOG: log }, timeout: 240_000,
    });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout || '{}') as { decision?: string; reason?: string };
  };
  try {
    for (const file of [path.join(a, 'src', 'auth', 'policy.js'), path.join(b, 'test', 'a.test.js')]) {
      hook('track.mjs', { conversationId, workspacePaths: [], toolCall: { name: 'replace_file_content', args: { Path: file } } });
    }
    const stop = { conversationId, workspacePaths: [], terminationReason: 'NO_TOOL_CALL' };
    const first = hook('stop-gate.mjs', stop);
    assert.match(first.reason ?? '', /checks fail|failed/, 'the failure comes first');
    writeFileSync(path.join(b, 'test', 'a.test.js'), "import t from 'node:test'; t('ok', () => {});\n");
    const second = hook('stop-gate.mjs', stop);
    assert.match(second.reason ?? '', /senior-finish step 4/, 'then the review that had to wait');
    assert.deepEqual(hook('stop-gate.mjs', stop), {});
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
    rmSync(log, { force: true });
  }
});

test('the Antigravity stop gate asks for the same review, once', () => {
  const dir = repoWith('src/auth/policy.js');
  const log = path.join(os.tmpdir(), `rev-${process.pid}.log`);
  const conversationId = `agy${process.pid}`;
  const hook = (script: string, input: object) => {
    const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'antigravity', 'hooks', script)], {
      input: JSON.stringify(input), encoding: 'utf8', env: { ...env, SENIOROS_HOOK_LOG: log }, timeout: 240_000,
    });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout || '{}') as { decision?: string; reason?: string };
  };
  try {
    hook('track.mjs', { conversationId, workspacePaths: [], toolCall: { name: 'replace_file_content', args: { Path: path.join(dir, 'src', 'auth', 'policy.js') } } });
    const stop = { conversationId, workspacePaths: [], terminationReason: 'NO_TOOL_CALL' };
    const first = hook('stop-gate.mjs', stop);
    assert.equal(first.decision, 'continue');
    assert.match(first.reason ?? '', /senior-finish step 4/);
    assert.deepEqual(hook('stop-gate.mjs', stop), {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(log, { force: true });
  }
});
