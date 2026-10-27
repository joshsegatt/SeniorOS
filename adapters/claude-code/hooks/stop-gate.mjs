// Claude Code Stop hook: when the agent tries to finish with changed code, run `senior finish`. On a failing check,
// block the stop and send the agent back with the output, at most MAX_BLOCKS times per change set, so it cannot loop.
// Passing results are cached per change set. Fails open: no git repository, no proof source, or no runnable CLI.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SENIOR, sh, tail } from '../../antigravity/hooks/lib.mjs';

const MAX_BLOCKS = 2;
const FINISH_TIMEOUT_MS = 270_000;
// Changes to these paths alone never trigger the gate.
const NON_CODE = /(\.(md|mdx|txt|png|jpe?g|gif|svg|webp|ico|pdf|lock|log)$)|(^|\/)\.senior\/|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i;
const STATE_DIR = join(tmpdir(), 'senioros-claude');

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
  const local = sh(`${SENIOR} finish --json`, root, FINISH_TIMEOUT_MS);
  const missing = !local.timedOut && local.code !== 0 && !local.out.trim() && /not (found|recognized)|ENOENT/i.test(local.err);
  return missing ? sh('npx -y senioros finish --json', root, FINISH_TIMEOUT_MS) : local;
}

/**
 * Decides whether Claude Code may stop.
 * @param {{ cwd?: string, session_id?: string }} input the Stop hook payload
 * @returns {object | null} a block decision, or null to let the agent finish
 */
export function decide(input) {
  const top = sh('git rev-parse --show-toplevel', input.cwd ?? process.cwd(), 10_000);
  if (top.code !== 0) return null;
  const root = top.out.trim();
  if (!existsSync(join(root, 'package.json')) && !existsSync(join(root, '.senior', 'config.json'))) return null;
  const changes = changeSet(root);
  if (!changes) return null;

  const session = String(input.session_id ?? 'unknown').replace(/[^\w-]/g, '');
  const stateFile = join(STATE_DIR, `${session}.json`);
  let state = {};
  try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}
  const key = root.toLowerCase();
  const prev = state[key];
  if (prev?.fingerprint === changes.fingerprint && (prev.result === 'pass' || prev.blocks >= MAX_BLOCKS)) return null;

  const run = runFinish(root);
  let report = null;
  try { report = JSON.parse(run.out); } catch {}
  const checks = report?.checks ?? [];
  const failed = checks.filter((c) => c.status === 'fail');
  const save = (entry) => { state[key] = entry; try { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(stateFile, JSON.stringify(state)); } catch {} };

  // A slow suite or an unreadable report never holds the agent hostage.
  if (run.timedOut || !report || failed.length === 0) {
    save({ fingerprint: changes.fingerprint, result: 'pass' });
    return null;
  }

  const blocks = prev?.fingerprint === changes.fingerprint ? (prev.blocks ?? 0) + 1 : 1;
  save({ fingerprint: changes.fingerprint, result: 'fail', blocks });
  const summary = checks.map((c) => `${c.status.toUpperCase()} ${c.name}${c.command ? ` (${c.command}${c.exitCode != null ? `, exit ${c.exitCode}` : ''})` : ''}`).join('\n');
  return {
    decision: 'block',
    reason: [
      'SeniorOS finish gate: code changed and the project checks fail. Do not report the task as done yet.',
      summary,
      `Last output lines:\n${tail(run.err || run.out, 40, 3500)}`,
      'Fix the root cause (do not weaken or skip tests) and run the checks again. If the failure existed before your change or cannot be fixed now, say so with this evidence instead of claiming success.'
    ].join('\n\n')
  };
}

if (/[\\/]claude-code[\\/]hooks[\\/]stop-gate\.mjs$/.test(process.argv[1] ?? '')) {
  try {
    const response = decide(JSON.parse(readFileSync(0, 'utf8') || '{}'));
    if (response) process.stdout.write(JSON.stringify(response));
  } catch {
    // Fail open: the agent may stop.
  }
}
