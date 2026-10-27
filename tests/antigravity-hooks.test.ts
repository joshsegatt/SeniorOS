import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const hooksDir = path.join(process.cwd(), 'adapters', 'antigravity', 'hooks');
const lib = (await import(pathToFileURL(path.join(hooksDir, 'lib.mjs')).href)) as { pathsInArgs: (args: unknown) => string[] };

function hook(script: string, input: unknown, args: string[] = [], env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [path.join(hooksDir, script), ...args], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 120_000,
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout) as Record<string, unknown>;
}

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

test('guard always answers with a decision: Antigravity denies a call without one', () => {
  const env = { SENIOROS_HOOK_LOG: path.join(os.tmpdir(), 'senioros-test-hooks.log') };
  const routine = { toolCall: { name: 'run_command', args: { CommandLine: 'git status' } } };
  assert.deepEqual(hook('guard.mjs', routine, [], env), { decision: 'ask' });
  assert.deepEqual(hook('guard.mjs', routine, ['--passthrough=allow'], env), { decision: 'allow' });
  assert.deepEqual(hook('guard.mjs', 'not json', ['--passthrough=allow'], env), { decision: 'allow' });
  const destructive = hook('guard.mjs', { toolCall: { name: 'run_command', args: { CommandLine: 'git reset --hard' } } }, ['--passthrough=allow'], env);
  assert.equal(destructive.decision, 'force_ask');
});

test('hook log lines carry the conversation id, so parallel bench runs are told apart', () => {
  const log = path.join(os.tmpdir(), `senioros-test-conv-${process.pid}.log`);
  rmSync(log, { force: true });
  try {
    const input = { conversationId: 'conv-123', toolCall: { name: 'run_command', args: { CommandLine: 'git push --force' } } };
    hook('guard.mjs', input, ['--passthrough=allow'], { SENIOROS_HOOK_LOG: log });
    const lines = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    assert.ok(lines.length > 0);
    assert.ok(lines.every((l) => l.conversationId === 'conv-123'));
  } finally {
    rmSync(log, { force: true });
  }
});

test('pathsInArgs finds absolute paths in file arguments and command lines', () => {
  const found = lib.pathsInArgs({
    Path: 'C:/work/app/src/a.js',
    CommandLine: 'cd C:\\work\\api; npm test',
    Nested: [{ TargetFile: '/Users/dev/site/index.html' }],
    Relative: 'src/b.js',
  });
  assert.deepEqual(found.sort(), ['/Users/dev/site/index.html', 'C:/work/app/src/a.js', 'C:\\work\\api'].sort());
});

test('a repository first touched mid-conversation gets its project context once', () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'soc-'));
  const env = {
    SENIOROS_HOOK_LOG: path.join(repo, '..', `soc-${path.basename(repo)}.log`),
    SENIOROS_CLI: `"${process.execPath}" "${path.join(process.cwd(), 'dist', 'src', 'index.js')}"`,
  };
  const conversationId = `ctx-${path.basename(repo)}`;
  try {
    git(repo, 'init', '-q');
    mkdirSync(path.join(repo, '.senior'));
    writeFileSync(path.join(repo, '.senior', 'decisions.md'), '# Decisions\n\n## 2026-10-01 — Money\n\nAll money is integer cents.\n');
    assert.deepEqual(hook('context.mjs', { conversationId }, [], env), {});

    hook('track.mjs', { conversationId, toolCall: { name: 'view_file', args: { Path: path.join(repo, 'README.md') } } }, [], env);
    const injected = hook('context.mjs', { conversationId }, [], env) as { injectSteps?: Array<{ systemMessage: { systemMessage: string } }> };
    const message = injected.injectSteps?.[0]?.systemMessage.systemMessage ?? '';
    assert.match(message, /All money is integer cents/);
    assert.deepEqual(hook('context.mjs', { conversationId }, [], env), {});
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(env.SENIOROS_HOOK_LOG, { force: true });
  }
});

test('stop gate proves a repository the agent edited in a conversation without a workspace', () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'sog-'));
  const env = {
    SENIOROS_HOOK_LOG: path.join(repo, '..', `sog-${path.basename(repo)}.log`),
    // The CLI built from this checkout, so the test does not depend on a global install.
    SENIOROS_CLI: `"${process.execPath}" "${path.join(process.cwd(), 'dist', 'src', 'index.js')}"`,
  };
  const conversationId = `test-${path.basename(repo)}`;
  try {
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'g', scripts: { test: 'node check.js' } }));
    writeFileSync(path.join(repo, 'check.js'), 'process.exit(0)\n');
    git(repo, 'init', '-q');
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
    writeFileSync(path.join(repo, 'check.js'), 'console.error("boom"); process.exit(1)\n');

    const edited = { conversationId, workspacePaths: [], toolCall: { name: 'replace_file_content', args: { Path: path.join(repo, 'check.js') } } };
    assert.deepEqual(hook('track.mjs', edited, [], env), {});
    const stop = hook('stop-gate.mjs', { conversationId, workspacePaths: [], terminationReason: 'NO_TOOL_CALL' }, [], env);
    assert.equal(stop.decision, 'continue');
    assert.match(String(stop.reason), /boom/);

    const reading = { conversationId: `${conversationId}-read`, workspacePaths: [], toolCall: { name: 'view_file', args: { Path: path.join(repo, 'check.js') } } };
    hook('track.mjs', reading, [], env);
    assert.deepEqual(hook('stop-gate.mjs', { conversationId: `${conversationId}-read`, workspacePaths: [], terminationReason: 'NO_TOOL_CALL' }, [], env), {});
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(env.SENIOROS_HOOK_LOG, { force: true });
  }
});
