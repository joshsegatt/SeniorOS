// Cursor stop hook: runs the shared finish gate (../../shared/finish-gate.mjs) when the agent completes with changed
// code. On a failing check it answers a `followup_message`, which Cursor sends as the next user message, so the agent
// goes back to fix it. Cursor's `loop_limit` and the gate's own per-change-set cap both stop it looping. Fails open.
import { readFileSync } from 'node:fs';
import { evaluate } from '../../shared/finish-gate.mjs';

/**
 * @param {{ status?: string, conversation_id?: string, workspace_roots?: string[] }} input the stop payload
 * @returns {{ followup_message?: string }}
 */
export function decide(input) {
  if (input.status && input.status !== 'completed') return {};
  const cwd = input.workspace_roots?.[0] || process.env.CURSOR_PROJECT_DIR || process.cwd();
  const reason = evaluate({ cwd, sessionId: input.conversation_id, host: 'cursor' });
  return reason ? { followup_message: reason } : {};
}

export function main() {
  let response = {};
  try {
    response = decide(JSON.parse(readFileSync(0, 'utf8') || '{}'));
  } catch {}
  process.stdout.write(JSON.stringify(response));
}
