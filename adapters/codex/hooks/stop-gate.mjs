// Codex Stop hook: runs the shared finish gate (../../shared/finish-gate.mjs) when the agent ends a turn with changed
// code. On a failing check it answers `decision: "block"`, which Codex turns into a new prompt carrying the reason, so
// the agent goes back to fix it. The gate's per-change-set cap stops it looping. Fails open.
import { readFileSync } from 'node:fs';
import { evaluate } from '../../shared/finish-gate.mjs';

/**
 * @param {{ cwd?: string, session_id?: string }} input the Stop payload
 * @returns {{ decision: 'block', reason: string } | null} a block decision, or null to let the agent finish
 */
export function decide(input) {
  const reason = evaluate({ cwd: input.cwd, sessionId: input.session_id, host: 'codex' });
  return reason ? { decision: 'block', reason } : null;
}

export function main() {
  let response = null;
  try {
    response = decide(JSON.parse(readFileSync(0, 'utf8') || '{}'));
  } catch {}
  // Codex reads the Stop answer as JSON: an empty object lets the agent finish.
  process.stdout.write(JSON.stringify(response ?? {}));
}
