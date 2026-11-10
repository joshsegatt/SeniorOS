// Stop: when the agent tries to finish a turn with code changes in the workspace, run `senior finish`.
// If a check fails, send the agent back to work with the failure output (at most MAX_BLOCKS times
// for the same set of changes, so it can never loop forever). Passing results are cached per change set. Once per
// conversation and project, a medium-or-higher-risk change whose checks pass goes back for senior-finish's risk review.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FINISH_TIMEOUT_MS, MIN_RUN_MS, NOT_VERIFIED, baselineProven, finishGateNextStep, finishNotVerifiedMessage, finishReviewMessage, hasProofSource, log, needsFinishReview, runHook, runSenior, sh, tail, workspaceRoots } from './lib.mjs';

const MAX_BLOCKS = 2;
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
  /** Projects where the gate verified nothing (see NOT_VERIFIED) and the agent was not told yet. */
  const unverified = [];
  const review = [];
  let repeated = true;
  // Set when a project sent for review has no passing proof baseline: the review then says NOT PROVEN.
  let unproven = false;
  // One budget for every project, under the host's 300 s hook limit: a second slow project gets what is left.
  const deadline = Date.now() + FINISH_TIMEOUT_MS;

  for (const { root, git } of workspaceRoots(input)) {
    if (!git || !hasProofSource(root)) continue;
    const changes = changeSet(root);
    if (!changes) continue;

    const key = root.toLowerCase();
    const prev = state[key];
    const reviewed = Boolean(prev?.reviewed);
    if (prev?.fingerprint === changes.fingerprint && (prev.result === 'pass' || NOT_VERIFIED.has(prev.result) || prev.blocks >= MAX_BLOCKS)) {
      // Saved results that still owe the agent a message: a run that verified nothing it was not told about, or a review that had to
      // wait (for a failure elsewhere, or for the timeout message to go first).
      if (NOT_VERIFIED.has(prev.result) && !prev.notified) unverified.push(root);
      else if (prev.result !== 'fail' && typeof prev.pendingReview === 'boolean' && !reviewed) {
        review.push(key);
        if (!prev.pendingReview) unproven = true;
      }
      continue;
    }

    const started = Date.now();
    const budget = deadline - started;
    // Falls back to `npx senioros` when the CLI is not on PATH, as the other hosts' gate does.
    const run = budget >= MIN_RUN_MS ? runSenior('finish --json', root, budget) : { timedOut: true, out: '', err: '', code: null };
    const ms = Date.now() - started;
    let report = null;
    try { report = JSON.parse(run.out); } catch {}

    if (run.timedOut || !report) {
      const result = run.timedOut ? 'timeout' : 'unreadable';
      log('Stop', { root, result, ms });
      // Never hold the agent hostage to a slow suite or a broken CLI, but say once that nothing was verified; its risk review, if
      // due, follows on a later stop.
      const due = !reviewed && needsFinishReview(root);
      state[key] = { fingerprint: changes.fingerprint, result, reviewed, notified: false, ...(due ? { pendingReview: false } : {}) };
      unverified.push(root);
      saveState(conversationId, state);
      continue;
    }
    /** @type {Array<{name: string, status: string, command: string | null, exitCode: number | null}>} */
    const checks = report?.checks ?? [];
    const failed = checks.filter((c) => c.status === 'fail');
    if (failed.length === 0) {
      // Once per conversation and project, a medium-or-higher-risk change whose checks pass goes back for the risk
      // review of senior-finish (see finishReviewMessage). Kept as pending until it is actually sent (below), so a
      // failure elsewhere, or a hook killed later, does not lose it.
      const proven = baselineProven(report);
      if (!reviewed && needsFinishReview(root)) {
        review.push(key);
        if (!proven) unproven = true;
        state[key] = { fingerprint: changes.fingerprint, result: 'pass', reviewed, pendingReview: proven };
      } else if (!proven) {
        // No review is due (low risk, or already reviewed), and no check proves the change: say so instead of passing.
        state[key] = { fingerprint: changes.fingerprint, result: 'unproven', reviewed, notified: false };
        unverified.push(root);
      } else {
        state[key] = { fingerprint: changes.fingerprint, result: 'pass', reviewed };
      }
      log('Stop', { root, result: state[key].result, ms, available: report.availableChecks });
      saveState(conversationId, state);
      continue;
    }

    const blocks = prev?.fingerprint === changes.fingerprint ? (prev.blocks ?? 0) + 1 : 1;
    state[key] = { fingerprint: changes.fingerprint, result: 'fail', blocks, reviewed };
    if (blocks === 1) repeated = false;
    const summary = checks.map((c) => `${c.status.toUpperCase()} ${c.name}${c.command ? ` (${c.command}${c.exitCode != null ? `, exit ${c.exitCode}` : ''})` : ''}`).join('\n');
    failures.push(`Project ${root}\n${summary}\nLast output lines:\n${tail(run.err, 40, 3500)}`);
    log('Stop', { root, result: 'fail', blocks, ms, failed: failed.map((c) => c.name) });
    saveState(conversationId, state);
  }

  // A review goes out alone, once nothing failed or went unverified; until then it stays pending in the state.
  const sendReview = failures.length === 0 && unverified.length === 0 && review.length > 0;
  if (sendReview) {
    for (const key of review) {
      state[key].reviewed = true;
      delete state[key].pendingReview;
    }
  }
  for (const root of unverified) state[root.toLowerCase()].notified = true;
  saveState(conversationId, state);
  if (sendReview) {
    log('Stop', { result: 'review', roots: review });
    return { decision: 'continue', reason: finishReviewMessage(!unproven) };
  }
  if (failures.length === 0 && unverified.length === 0) return {};
  const failed = failures.length
    ? ['SeniorOS finish gate: code changed and `senior finish` failed. Do not finish yet.', ...failures, finishGateNextStep(repeated)]
    : [];
  // One message per kind of unverified run, each naming its projects.
  const notices = [...NOT_VERIFIED].map((result) => [result, unverified.filter((root) => state[root.toLowerCase()].result === result)])
    .filter(([, roots]) => roots.length).map(([result, roots]) => finishNotVerifiedMessage(result, roots));
  return { decision: 'continue', reason: [...failed, ...notices].join('\n\n') };
});
