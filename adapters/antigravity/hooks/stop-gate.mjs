// Stop: when the agent tries to finish a turn with code changes in the workspace, run `senior finish`.
// If a check fails, send the agent back to work with the failure output (at most MAX_BLOCKS times
// for the same set of changes, so it can never loop forever). Passing results are cached per change set. Once per
// conversation and project, a medium-or-higher-risk change whose checks pass goes back for senior-finish's risk review.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SENIOR, finishGateNextStep, finishReviewMessage, hasProofSource, log, needsFinishReview, runHook, sh, tail, workspaceRoots } from './lib.mjs';

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

await runHook('Stop', async (input) => {
  if (input.terminationReason && input.terminationReason !== 'NO_TOOL_CALL') return {};
  const conversationId = String(input.conversationId ?? 'unknown').replace(/[^\w-]/g, '');
  const state = loadState(conversationId);
  const failures = [];
  const review = [];
  let repeated = true;

  for (const { root, git } of workspaceRoots(input)) {
    if (!git || !hasProofSource(root)) continue;
    const changes = changeSet(root);
    if (!changes) continue;

    const key = root.toLowerCase();
    const prev = state[key];
    const reviewed = Boolean(prev?.reviewed);
    if (prev?.fingerprint === changes.fingerprint && (prev.result === 'pass' || prev.blocks >= MAX_BLOCKS)) continue;

    const started = Date.now();
    const run = sh(`${SENIOR} finish --json`, root, FINISH_TIMEOUT_MS);
    const ms = Date.now() - started;
    let report = null;
    try { report = JSON.parse(run.out); } catch {}

    if (run.timedOut) {
      log('Stop', { root, result: 'timeout', ms });
      state[key] = { fingerprint: changes.fingerprint, result: 'pass', reviewed }; // never hold the agent hostage to a slow suite
      continue;
    }
    /** @type {Array<{name: string, status: string, command: string | null, exitCode: number | null}>} */
    const checks = report?.checks ?? [];
    const failed = checks.filter((c) => c.status === 'fail');
    if (!report || failed.length === 0) {
      // Once per conversation and project, a medium-or-higher-risk change whose checks pass goes back for the risk
      // review of senior-finish (see finishReviewMessage).
      const askReview = Boolean(report) && !reviewed && needsFinishReview(root);
      if (askReview) review.push(root);
      state[key] = { fingerprint: changes.fingerprint, result: 'pass', reviewed: reviewed || askReview };
      log('Stop', { root, result: report ? 'pass' : 'unparsed', ms, available: report?.availableChecks });
      continue;
    }

    const blocks = prev?.fingerprint === changes.fingerprint ? (prev.blocks ?? 0) + 1 : 1;
    state[key] = { fingerprint: changes.fingerprint, result: 'fail', blocks, reviewed };
    if (blocks === 1) repeated = false;
    const summary = checks.map((c) => `${c.status.toUpperCase()} ${c.name}${c.command ? ` (${c.command}${c.exitCode != null ? `, exit ${c.exitCode}` : ''})` : ''}`).join('\n');
    failures.push(`Project ${root}\n${summary}\nLast output lines:\n${tail(run.err, 40, 3500)}`);
    log('Stop', { root, result: 'fail', blocks, ms, failed: failed.map((c) => c.name) });
  }

  saveState(conversationId, state);
  if (failures.length === 0 && review.length > 0) {
    log('Stop', { result: 'review', roots: review });
    return { decision: 'continue', reason: finishReviewMessage() };
  }
  if (failures.length === 0) return {};
  return {
    decision: 'continue',
    reason: [
      'SeniorOS finish gate: code changed and `senior finish` failed. Do not finish yet.',
      ...failures,
      finishGateNextStep(repeated)
    ].join('\n\n')
  };
});
