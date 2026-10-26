// Stop: when the agent tries to finish a turn with code changes in the workspace, run `senior finish`.
// If a check fails, send the agent back to work with the failure output (at most MAX_BLOCKS times
// for the same set of changes, so it can never loop forever). Passing results are cached per change set.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { log, runHook, sh, tail, workspaceRoots } from './lib.mjs';

const MAX_BLOCKS = 2;
const FINISH_TIMEOUT_MS = 270_000;
// Changes to these paths alone never trigger the gate.
const NON_CODE = /(\.(md|mdx|txt|png|jpe?g|gif|svg|webp|ico|pdf|lock|log)$)|(^|\/)\.senior\/|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i;

const STATE_DIR = join(tmpdir(), 'senioros-agy');

/** @param {string} conversationId */
function loadState(conversationId) {
  try { return JSON.parse(readFileSync(join(STATE_DIR, `${conversationId}.json`), 'utf8')); } catch { return {}; }
}
/** @param {string} conversationId @param {object} state */
function saveState(conversationId, state) {
  try { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(join(STATE_DIR, `${conversationId}.json`), JSON.stringify(state)); } catch {}
}

/** Code files changed vs HEAD (tracked + untracked), and a fingerprint of their current content. @param {string} root */
function changeSet(root) {
  const status = sh('git status --porcelain --untracked-files=all', root, 15_000);
  if (status.code !== 0) return null;
  const files = status.out.split('\n').filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop() ?? '')
    .filter((f) => f && !NON_CODE.test(f));
  if (files.length === 0) return null;
  const hash = createHash('sha256');
  hash.update(sh('git diff HEAD', root, 15_000).out);
  for (const f of files.sort()) {
    try { const s = statSync(join(root, f)); hash.update(`${f}:${s.size}:${s.mtimeMs}\n`); } catch { hash.update(`${f}:gone\n`); }
  }
  return { files, fingerprint: hash.digest('hex') };
}

/** @param {string} root */
function hasProofSource(root) {
  return existsSync(join(root, 'package.json')) || existsSync(join(root, '.senior', 'config.json'));
}

await runHook('Stop', async (input) => {
  if (input.terminationReason && input.terminationReason !== 'NO_TOOL_CALL') return {};
  const conversationId = String(input.conversationId ?? 'unknown').replace(/[^\w-]/g, '');
  const state = loadState(conversationId);
  const failures = [];

  for (const { root, git } of workspaceRoots(input)) {
    if (!git || !hasProofSource(root)) continue;
    const changes = changeSet(root);
    if (!changes) continue;

    const key = root.toLowerCase();
    const prev = state[key];
    if (prev?.fingerprint === changes.fingerprint && (prev.result === 'pass' || prev.blocks >= MAX_BLOCKS)) continue;

    const started = Date.now();
    const run = sh('senior finish --json', root, FINISH_TIMEOUT_MS);
    const ms = Date.now() - started;
    let report = null;
    try { report = JSON.parse(run.out); } catch {}

    if (run.timedOut) {
      log('Stop', { root, result: 'timeout', ms });
      state[key] = { fingerprint: changes.fingerprint, result: 'pass' }; // never hold the agent hostage to a slow suite
      continue;
    }
    /** @type {Array<{name: string, status: string, command: string | null, exitCode: number | null}>} */
    const checks = report?.checks ?? [];
    const failed = checks.filter((c) => c.status === 'fail');
    if (!report || failed.length === 0) {
      state[key] = { fingerprint: changes.fingerprint, result: 'pass' };
      log('Stop', { root, result: report ? 'pass' : 'unparsed', ms, available: report?.availableChecks });
      continue;
    }

    const blocks = prev?.fingerprint === changes.fingerprint ? (prev.blocks ?? 0) + 1 : 1;
    state[key] = { fingerprint: changes.fingerprint, result: 'fail', blocks };
    const summary = checks.map((c) => `${c.status.toUpperCase()} ${c.name}${c.command ? ` (${c.command}${c.exitCode != null ? `, exit ${c.exitCode}` : ''})` : ''}`).join('\n');
    failures.push(`Project ${root}\n${summary}\nLast output lines:\n${tail(run.err, 40, 3500)}`);
    log('Stop', { root, result: 'fail', blocks, ms, failed: failed.map((c) => c.name) });
  }

  saveState(conversationId, state);
  if (failures.length === 0) return {};
  return {
    decision: 'continue',
    reason: [
      'SeniorOS finish gate: code changed and `senior finish` failed. Do not finish yet.',
      ...failures,
      'Fix the root cause (do not weaken or skip tests) and run `senior finish` again. If the failure existed before your change or cannot be fixed now, tell the user so with the evidence above instead of declaring the task done.'
    ].join('\n\n')
  };
});
