import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
function claudeStop(dir: string, session: string, hookEnv = env) {
  const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'claude-code', 'hooks', 'stop-gate.mjs')], {
    input: JSON.stringify({ cwd: dir, session_id: session }), encoding: 'utf8', env: hookEnv, timeout: 240_000,
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? (JSON.parse(r.stdout) as { decision: string; reason: string }) : null;
}

/** Stops an Antigravity conversation that edited `file`, through the real hook scripts. */
function antigravityStop(dir: string, conversationId: string, file: string, hookEnv = env) {
  const log = path.join(dir, '..', `${path.basename(dir)}.log`);
  const hook = (script: string, input: object) => {
    const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'antigravity', 'hooks', script)], {
      input: JSON.stringify(input), encoding: 'utf8', env: { ...hookEnv, SENIOROS_HOOK_LOG: log }, timeout: 240_000,
    });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout || '{}') as { decision?: string; reason?: string };
  };
  try {
    hook('track.mjs', { conversationId, workspacePaths: [], toolCall: { name: 'replace_file_content', args: { Path: path.join(dir, file) } } });
    return hook('stop-gate.mjs', { conversationId, workspacePaths: [], terminationReason: 'NO_TOOL_CALL' });
  } finally {
    rmSync(log, { force: true });
  }
}

test('a low-risk change that no check proves is reported once as NOT PROVEN, never passed in silence', () => {
  const dir = repoWith('src/format.js');
  // No test file at all, so `node --test` reports 0 tests.
  rmSync(path.join(dir, 'test'), { recursive: true, force: true });
  try {
    const first = claudeStop(dir, `lnp${process.pid}`);
    assert.equal(first?.decision, 'block');
    assert.match(first?.reason ?? '', /proof baseline is NOT PROVEN/);
    assert.doesNotMatch(first?.reason ?? '', /medium risk or higher/);
    assert.equal(claudeStop(dir, `lnp${process.pid}`), null, 'told once: the same change then finishes');

    const agy = antigravityStop(dir, `agylnp${process.pid}`, 'src/format.js');
    assert.equal(agy.decision, 'continue');
    assert.match(agy.reason ?? '', /proof baseline is NOT PROVEN/);
    assert.deepEqual(antigravityStop(dir, `agylnp${process.pid}`, 'src/format.js'), {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a `senior finish` that gives no readable report is reported once as NOT VERIFIED, never saved as a pass', () => {
  const dir = repoWith('src/format.js');
  // A CLI that exits without a report, as a broken install or an invalid .senior/config.json does.
  const broken = { ...env, SENIOROS_CLI: `"${process.execPath}" -e "process.exit(1)"` } as NodeJS.ProcessEnv;
  try {
    const first = claudeStop(dir, `unr${process.pid}`, broken);
    assert.equal(first?.decision, 'block');
    assert.match(first?.reason ?? '', /gave no readable report, so this change is NOT VERIFIED/);
    assert.equal(claudeStop(dir, `unr${process.pid}`, broken), null, 'told once: the same change then finishes');

    const agy = antigravityStop(dir, `agyunr${process.pid}`, 'src/format.js', broken);
    assert.equal(agy.decision, 'continue');
    assert.match(agy.reason ?? '', /gave no readable report \(.+\), so this change is NOT VERIFIED/);
    assert.deepEqual(antigravityStop(dir, `agyunr${process.pid}`, 'src/format.js', broken), {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

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

test('a medium-risk change whose tests ran nothing is reviewed as NOT PROVEN, never as passing (review finding)', () => {
  const dir = repoWith('src/auth/policy.js');
  // No test file at all, so `node --test` reports 0 tests. (A file with no tests in it counts as one passing test.)
  rmSync(path.join(dir, 'test'), { recursive: true, force: true });
  const log = path.join(os.tmpdir(), `rev3-${process.pid}.log`);
  try {
    const claude = claudeStop(dir, `np${process.pid}`);
    assert.equal(claude?.decision, 'block');
    // Both phrases also appear in the message's later text, so match the opening sentence only.
    assert.match(claude?.reason ?? '', /proof baseline is NOT PROVEN/);
    assert.doesNotMatch(claude?.reason ?? '', /finish gate: the checks pass/);

    const conversationId = `agy3${process.pid}`;
    const hook = (script: string, input: object) => {
      const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'antigravity', 'hooks', script)], {
        input: JSON.stringify(input), encoding: 'utf8', env: { ...env, SENIOROS_HOOK_LOG: log }, timeout: 240_000,
      });
      assert.equal(r.status, 0, r.stderr);
      return JSON.parse(r.stdout || '{}') as { decision?: string; reason?: string };
    };
    hook('track.mjs', { conversationId, workspacePaths: [], toolCall: { name: 'replace_file_content', args: { Path: path.join(dir, 'src', 'auth', 'policy.js') } } });
    const agy = hook('stop-gate.mjs', { conversationId, workspacePaths: [], terminationReason: 'NO_TOOL_CALL' });
    assert.equal(agy.decision, 'continue');
    assert.match(agy.reason ?? '', /proof baseline is NOT PROVEN/);
    assert.doesNotMatch(agy.reason ?? '', /finish gate: the checks pass/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(log, { force: true });
  }
});

test('checks that do not finish in time are reported once as NOT VERIFIED, never passed in silence', () => {
  const dir = repoWith('src/format.js');
  // A suite slower than the gate's limit, lowered to 2 s here.
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node -e "setTimeout(() => {}, 6000)"' } }));
  const slow = { ...env, SENIOROS_FINISH_TIMEOUT_MS: '2000' };
  const log = path.join(os.tmpdir(), `rev4-${process.pid}.log`);
  try {
    const stop = (session: string) => {
      const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'claude-code', 'hooks', 'stop-gate.mjs')], {
        input: JSON.stringify({ cwd: dir, session_id: session }), encoding: 'utf8', env: slow, timeout: 60_000,
      });
      assert.equal(r.status, 0, r.stderr);
      return r.stdout ? (JSON.parse(r.stdout) as { decision: string; reason: string }) : null;
    };
    const first = stop(`to${process.pid}`);
    assert.equal(first?.decision, 'block');
    assert.match(first?.reason ?? '', /did not finish within 2 s, so this change is NOT VERIFIED/);
    assert.equal(stop(`to${process.pid}`), null, 'once per change set: the slow suite does not hold the agent');

    const hook = (script: string, input: object) => {
      const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'antigravity', 'hooks', script)], {
        input: JSON.stringify(input), encoding: 'utf8', env: { ...slow, SENIOROS_HOOK_LOG: log }, timeout: 60_000,
      });
      assert.equal(r.status, 0, r.stderr);
      return JSON.parse(r.stdout || '{}') as { decision?: string; reason?: string };
    };
    const conversationId = `agyto${process.pid}`;
    hook('track.mjs', { conversationId, workspacePaths: [], toolCall: { name: 'replace_file_content', args: { Path: path.join(dir, 'src', 'format.js') } } });
    const agyStop = { conversationId, workspacePaths: [], terminationReason: 'NO_TOOL_CALL' };
    const agy = hook('stop-gate.mjs', agyStop);
    assert.equal(agy.decision, 'continue');
    assert.match(agy.reason ?? '', /NOT VERIFIED/);
    assert.deepEqual(hook('stop-gate.mjs', agyStop), {});
  } finally {
    // On Windows the timed-out suite's process may still hold the folder for a few seconds.
    for (let i = 0; ; i++) {
      try { rmSync(dir, { recursive: true, force: true }); break; } catch (error) {
        if (i >= 30) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
      }
    }
    rmSync(log, { force: true });
  }
});

test('after a timeout, a due risk review still follows, and an unsent timeout is sent again (review findings)', async () => {
  const dir = repoWith('src/auth/policy.js');
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node -e "setTimeout(() => {}, 6000)"' } }));
  const slow = { ...env, SENIOROS_FINISH_TIMEOUT_MS: '2000' };
  try {
    const stop = (session: string) => {
      const r = spawnSync(process.execPath, [path.join(root, 'adapters', 'claude-code', 'hooks', 'stop-gate.mjs')], {
        input: JSON.stringify({ cwd: dir, session_id: session }), encoding: 'utf8', env: slow, timeout: 60_000,
      });
      assert.equal(r.status, 0, r.stderr);
      return r.stdout ? (JSON.parse(r.stdout) as { decision: string; reason: string }) : null;
    };
    const session = `tr${process.pid}`;
    assert.match(stop(session)?.reason ?? '', /NOT VERIFIED/);
    const second = stop(session)?.reason ?? '';
    assert.match(second, /senior-finish step 4/, 'the risk review is not dropped');
    assert.match(second, /proof baseline is NOT PROVEN/, 'and it does not say the checks pass');
    assert.equal(stop(session), null);

    // A timeout the host never delivered (the hook was killed before answering) is sent on the next stop.
    process.env.SENIOROS_FINISH_TIMEOUT_MS = '2000';
    process.env.SENIOROS_CLI = env.SENIOROS_CLI;
    const { assess } = (await import(`${pathToFileURL(path.join(root, 'adapters', 'shared', 'finish-gate.mjs')).href}?t=${Date.now()}`)) as {
      assess: (input: object) => { kind: string; accept?: () => void } | null;
    };
    const input = { cwd: dir, sessionId: `tk${process.pid}`, host: 'test' };
    assert.equal(assess(input)?.kind, 'timeout');
    const again = assess(input);
    assert.equal(again?.kind, 'timeout', 'not accepted, so still due');
    again?.accept?.();
    assert.equal(assess(input)?.kind, 'review');
  } finally {
    delete process.env.SENIOROS_FINISH_TIMEOUT_MS;
    delete process.env.SENIOROS_CLI;
    for (let i = 0; ; i++) {
      try { rmSync(dir, { recursive: true, force: true }); break; } catch (error) {
        if (i >= 30) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
      }
    }
  }
});

test('a passing typecheck does not make a run with no tests proven (review finding)', () => {
  const dir = repoWith('src/auth/policy.js');
  rmSync(path.join(dir, 'test'), { recursive: true, force: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module', scripts: { typecheck: 'node -e ""', test: 'node --test' } }));
  try {
    const reason = claudeStop(dir, `tc${process.pid}`)?.reason ?? '';
    assert.match(reason, /proof baseline is NOT PROVEN/);
    assert.doesNotMatch(reason, /finish gate: the checks pass/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
