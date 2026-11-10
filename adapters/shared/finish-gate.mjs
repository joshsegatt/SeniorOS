// Host-neutral finish gate: when the agent tries to finish with changed code, run `senior finish`. On a failing check
// it returns a reason to send the agent back, at most MAX_BLOCKS times per change set, so it cannot loop. Passing
// results are cached per change set. Once per session and repository, a medium-or-higher-risk change whose checks
// pass is sent back for senior-finish's risk review. A run that verified nothing (a timeout, no readable report, no
// check that proves the change) never blocks, but is never saved as a pass: the agent is told once. No git repository
// or no proof source: the gate does nothing.
// Each host adapter (Claude Code, Cursor) maps its own Stop payload and response onto `evaluate`.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FINISH_TIMEOUT_MS, MIN_RUN_MS, NOT_VERIFIED, baselineProven, finishGateNextStep, finishNotVerifiedMessage, finishReviewMessage, hasProofSource, needsFinishReview, runSenior, sh, tail } from '../antigravity/hooks/lib.mjs';

export const MAX_BLOCKS = 2;
/** Identity of a repository path: Windows paths are case-insensitive, POSIX paths are not. */
export const pathKey = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);

// Changes to these paths alone never trigger the gate.
const NON_CODE = /(\.(md|mdx|txt|png|jpe?g|gif|svg|webp|ico|pdf|lock|log)$)|(^|\/)\.senior\/|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i;

/** Code files changed vs HEAD (tracked and untracked) and a fingerprint of their current content. */
export function changeSet(root) {
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

/**
 * Runs `senior finish --json`, falling back to `npx senioros` when the CLI is not on PATH. With a `deadline` (a host
 * checking several repositories in one hook), it gets only the time left, and does not start with less than 5 s.
 */
function runFinish(root, deadline) {
  const budget = deadline ? Math.min(FINISH_TIMEOUT_MS, deadline - Date.now()) : FINISH_TIMEOUT_MS;
  return budget >= MIN_RUN_MS ? runSenior('finish --json', root, budget) : { timedOut: true, out: '', err: '', code: null };
}

/**
 * True when a final reply already does what the risk review asks: names residual risk and gives a ship status.
 * @param {string | undefined} text
 */
export function reportCoversReview(text) {
  if (typeof text !== 'string') return false;
  const STATUS = /\b(READY WITH RESIDUAL RISK|NOT READY|READY|NOT PROVEN|BLOCKED)\b/g;
  if (!STATUS.test(text)) return false;
  // The status "READY WITH RESIDUAL RISK" says risk but names none: the reply must mention a risk outside the status.
  return /\brisks?\b/i.test(text.replace(STATUS, ' '));
}

/**
 * Decides whether the agent may finish.
 * @param {{ cwd?: string, sessionId?: string, host: string, lastMessage?: string }} input
 * @returns {string | null} why the agent must go back, or null to let it finish
 */
export function evaluate(input) {
  const result = assess(input);
  result?.accept?.();
  return result?.reason ?? null;
}

/**
 * Like `evaluate`, but says what kind of request it is: `fail` (the checks fail), `timeout`, `unreadable` or `unproven`
 * (they did not finish in time, gave no readable report, or none of them proves the change: nothing is verified) or `review` (the checks pass on a medium-or-higher-risk change). A review or a
 * not-verified notice counts as sent only once `accept()` is called; until then it stays due for this change set and the next
 * call returns it again from the saved result, without running the checks. A host checking several repositories uses
 * this to send failures first and the review only when none fails, with one `deadline` for all of them.
 * `lastMessage` is the agent's final reply, when the host sends it: a proven change whose reply already names its
 * residual risks and a ship status gets no review, since the review would ask for the same text again.
 * @param {{ cwd?: string, sessionId?: string, host: string, deadline?: number, lastMessage?: string }} input
 * @returns {{ kind: 'fail' | 'timeout' | 'unreadable' | 'unproven' | 'review', reason: string, accept?: () => void } | null}
 */
export function assess({ cwd, sessionId, host, deadline, lastMessage }) {
  const top = sh('git rev-parse --show-toplevel', cwd ?? process.cwd(), 10_000);
  if (top.code !== 0) return null;
  const root = top.out.trim();
  if (!hasProofSource(root)) return null;
  const changes = changeSet(root);
  if (!changes) return null;

  const stateDir = join(tmpdir(), `senioros-${host}`);
  const session = String(sessionId ?? 'unknown').replace(/[^\w-]/g, '');
  const stateFile = join(stateDir, `${session}.json`);
  const load = () => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return {}; } };
  const key = pathKey(root);
  const prev = load()[key];
  // The file holds every repository of the session, and `accept` may run after other repositories saved: read it again
  // so this entry is the only one written.
  const save = (entry) => { const state = load(); state[key] = entry; try { mkdirSync(stateDir, { recursive: true }); writeFileSync(stateFile, JSON.stringify(state)); } catch {} };
  /** The risk review, due on this change set until accepted. */
  const review = (fingerprint, proven) => {
    save({ fingerprint, result: 'pass', reviewed: false, pendingReview: proven });
    return { kind: 'review', reason: finishReviewMessage(proven), accept: () => save({ fingerprint, result: 'pass', reviewed: true }) };
  };
  /** Nothing verified: due until accepted, so a hook killed before it answers still tells the agent next time. */
  const notVerified = (entry) => {
    save({ ...entry, notified: false });
    return { kind: entry.result, reason: finishNotVerifiedMessage(entry.result), accept: () => save({ ...entry, notified: true }) };
  };
  // A run that verified nothing is reported once per change set: running a suite that slow again on every stop would
  // hold the agent.
  if (prev?.fingerprint === changes.fingerprint && (prev.result === 'pass' || NOT_VERIFIED.has(prev.result) || prev.blocks >= MAX_BLOCKS)) {
    if (NOT_VERIFIED.has(prev.result) && !prev.notified) return notVerified({ fingerprint: prev.fingerprint, result: prev.result, reviewed: Boolean(prev.reviewed), ...(typeof prev.pendingReview === 'boolean' ? { pendingReview: prev.pendingReview } : {}) });
    // A review kept back (by a failure elsewhere, or behind a timeout message) goes out now.
    return prev.result !== 'fail' && typeof prev.pendingReview === 'boolean' && !prev.reviewed ? review(prev.fingerprint, prev.pendingReview) : null;
  }

  const run = runFinish(root, deadline);
  let report = null;
  try { report = JSON.parse(run.out); } catch {}
  const checks = report?.checks ?? [];
  const failed = checks.filter((c) => c.status === 'fail');

  // Once per session and repository, a medium-or-higher-risk change whose checks pass is sent back for the risk
  // review of senior-finish: passing checks show only the cases they cover.
  const reviewed = Boolean(prev?.reviewed);

  // A slow suite or a broken CLI never holds the agent hostage, but its silence is not a pass: the agent is told, once,
  // that nothing was verified.
  // A risk review that is due follows on a later stop, as NOT PROVEN since nothing ran to the end.
  if (run.timedOut || !report) {
    const due = !reviewed && needsFinishReview(root);
    return notVerified({ fingerprint: changes.fingerprint, result: run.timedOut ? 'timeout' : 'unreadable', reviewed, ...(due ? { pendingReview: false } : {}) });
  }

  if (failed.length === 0) {
    const proven = baselineProven(report);
    if (!reviewed && needsFinishReview(root)) {
      if (proven && reportCoversReview(lastMessage)) {
        save({ fingerprint: changes.fingerprint, result: 'pass', reviewed: true });
        return null;
      }
      return review(changes.fingerprint, proven);
    }
    // No review is due (low risk, or already reviewed), and no check proves the change: say so instead of passing.
    if (!proven) return notVerified({ fingerprint: changes.fingerprint, result: 'unproven', reviewed });
    save({ fingerprint: changes.fingerprint, result: 'pass', reviewed });
    return null;
  }

  const blocks = prev?.fingerprint === changes.fingerprint ? (prev.blocks ?? 0) + 1 : 1;
  save({ fingerprint: changes.fingerprint, result: 'fail', blocks, reviewed });
  const summary = checks.map((c) => `${c.status.toUpperCase()} ${c.name}${c.command ? ` (${c.command}${c.exitCode != null ? `, exit ${c.exitCode}` : ''})` : ''}`).join('\n');
  return { kind: 'fail', reason: [
    'SeniorOS finish gate: code changed and the project checks fail. Do not report the task as done yet.',
    summary,
    `Last output lines:\n${tail(run.err || run.out, 40, 3500)}`,
    finishGateNextStep(blocks > 1)
  ].join('\n\n') };
}
