// Host-neutral finish gate: when the agent tries to finish with changed code, run `senior finish`. On a failing check
// it returns a reason to send the agent back, at most MAX_BLOCKS times per change set, so it cannot loop. Passing
// results are cached per change set. Once per session and repository, a medium-or-higher-risk change whose checks
// pass is sent back for senior-finish's risk review. Fails open: no git repository, no proof source, or no runnable CLI.
// Each host adapter (Claude Code, Cursor) maps its own Stop payload and response onto `evaluate`.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finishGateNextStep, finishReviewMessage, hasProofSource, needsFinishReview, runSenior, sh, tail } from '../antigravity/hooks/lib.mjs';

export const MAX_BLOCKS = 2;
const FINISH_TIMEOUT_MS = 270_000;
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

/** Runs `senior finish --json`, falling back to `npx senioros` when the CLI is not on PATH. */
function runFinish(root) {
  return runSenior('finish --json', root, FINISH_TIMEOUT_MS);
}

/**
 * Decides whether the agent may finish.
 * @param {{ cwd?: string, sessionId?: string, host: string }} input
 * @returns {string | null} why the agent must go back, or null to let it finish
 */
export function evaluate({ cwd, sessionId, host }) {
  const top = sh('git rev-parse --show-toplevel', cwd ?? process.cwd(), 10_000);
  if (top.code !== 0) return null;
  const root = top.out.trim();
  if (!hasProofSource(root)) return null;
  const changes = changeSet(root);
  if (!changes) return null;

  const stateDir = join(tmpdir(), `senioros-${host}`);
  const session = String(sessionId ?? 'unknown').replace(/[^\w-]/g, '');
  const stateFile = join(stateDir, `${session}.json`);
  let state = {};
  try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}
  const key = pathKey(root);
  const prev = state[key];
  if (prev?.fingerprint === changes.fingerprint && (prev.result === 'pass' || prev.blocks >= MAX_BLOCKS)) return null;

  const run = runFinish(root);
  let report = null;
  try { report = JSON.parse(run.out); } catch {}
  const checks = report?.checks ?? [];
  const failed = checks.filter((c) => c.status === 'fail');
  const save = (entry) => { state[key] = entry; try { mkdirSync(stateDir, { recursive: true }); writeFileSync(stateFile, JSON.stringify(state)); } catch {} };

  // Once per session and repository, a medium-or-higher-risk change whose checks pass is sent back for the risk
  // review of senior-finish: passing checks show only the cases they cover.
  const reviewed = Boolean(prev?.reviewed);

  // A slow suite or an unreadable report never holds the agent hostage.
  if (run.timedOut || !report || failed.length === 0) {
    if (!reviewed && !run.timedOut && report && needsFinishReview(root)) {
      save({ fingerprint: changes.fingerprint, result: 'pass', reviewed: true });
      return finishReviewMessage();
    }
    save({ fingerprint: changes.fingerprint, result: 'pass', reviewed });
    return null;
  }

  const blocks = prev?.fingerprint === changes.fingerprint ? (prev.blocks ?? 0) + 1 : 1;
  save({ fingerprint: changes.fingerprint, result: 'fail', blocks, reviewed });
  const summary = checks.map((c) => `${c.status.toUpperCase()} ${c.name}${c.command ? ` (${c.command}${c.exitCode != null ? `, exit ${c.exitCode}` : ''})` : ''}`).join('\n');
  return [
    'SeniorOS finish gate: code changed and the project checks fail. Do not report the task as done yet.',
    summary,
    `Last output lines:\n${tail(run.err || run.out, 40, 3500)}`,
    finishGateNextStep(blocks > 1)
  ].join('\n\n');
}
