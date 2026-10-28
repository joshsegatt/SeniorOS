// Cursor stop hook: runs the shared finish gate (../../shared/finish-gate.mjs) when the agent completes with changed
// code. On a failing check it answers a `followup_message`, which Cursor sends as the next user message, so the agent
// goes back to fix it. Cursor's `loop_limit` and the gate's own per-change-set cap both stop it looping. Fails open.
import { readFileSync } from 'node:fs';
import { sh } from '../../antigravity/hooks/lib.mjs';
import { evaluate, pathKey } from '../../shared/finish-gate.mjs';

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
  const failures = repos
    .map((cwd) => ({ cwd, reason: evaluate({ cwd, sessionId: input.conversation_id, host: 'cursor' }) }))
    .filter((r) => r.reason);
  if (failures.length === 0) return {};
  const message = failures.length === 1 && repos.length === 1
    ? failures[0].reason
    : failures.map((f) => `Repository ${f.cwd}:\n\n${f.reason}`).join('\n\n---\n\n');
  return { followup_message: message };
}

export function main() {
  let response = {};
  try {
    response = decide(JSON.parse(readFileSync(0, 'utf8') || '{}'));
  } catch {}
  process.stdout.write(JSON.stringify(response));
}
