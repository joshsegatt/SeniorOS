// Cursor stop hook: runs the shared finish gate (../../shared/finish-gate.mjs) when the agent completes with changed
// code, in every git repository of the workspace. Its answer is a `followup_message`, which Cursor sends as the next
// user message: the failing checks, so the agent goes back to fix them, or, once nothing fails, the risk review of a
// medium-or-higher-risk change. A review never shares a message with another repository's failure; it stays due until
// no repository fails. Cursor's `loop_limit` caps the follow-ups in a row (a fix that changes the code starts a new
// change set, so the gate's own per-change-set cap does not end a long run of failures on its own). Fails open.
import { readFileSync } from 'node:fs';
import { FINISH_TIMEOUT_MS, sh } from '../../antigravity/hooks/lib.mjs';
import { assess, pathKey } from '../../shared/finish-gate.mjs';

/** Distinct git repositories behind the workspace folders: a multi-root workspace can hold several. */
function repositories(folders) {
  const roots = new Map();
  for (const folder of folders) {
    const top = sh('git rev-parse --show-toplevel', folder, 10_000);
    if (top.code === 0 && top.out.trim()) roots.set(pathKey(top.out.trim()), top.out.trim());
  }
  return [...roots.values()];
}

/**
 * @param {{ status?: string, conversation_id?: string, workspace_roots?: string[] }} input the stop payload
 * @returns {{ followup_message?: string }}
 */
export function decide(input) {
  if (input.status && input.status !== 'completed') return {};
  const folders = input.workspace_roots?.length ? input.workspace_roots : [process.env.CURSOR_PROJECT_DIR || process.cwd()];
  const repos = repositories(folders);
  // One budget for every repository, under Cursor's 300 s hook limit.
  const deadline = Date.now() + FINISH_TIMEOUT_MS;
  const results = repos
    .map((cwd) => ({ cwd, result: assess({ cwd, sessionId: input.conversation_id, host: 'cursor', deadline }) }))
    .filter((r) => r.result);
  // Failing and timed-out checks go first; a review waits for them.
  const failures = results.filter((r) => r.result.kind !== 'review');
  // Reviews go out, and count as sent, only when nothing fails; otherwise they stay due for their change set.
  const found = failures.length > 0 ? failures : results;
  if (found.length === 0) return {};
  // Everything in the message counts as sent: a timeout, or the reviews once nothing fails.
  for (const r of found) r.result.accept?.();
  const message = found.length === 1 && repos.length === 1
    ? found[0].result.reason
    : found.map((f) => `Repository ${f.cwd}:\n\n${f.result.reason}`).join('\n\n---\n\n');
  return { followup_message: message };
}

export function main() {
  let response = {};
  try {
    response = decide(JSON.parse(readFileSync(0, 'utf8') || '{}'));
  } catch {}
  process.stdout.write(JSON.stringify(response));
}
