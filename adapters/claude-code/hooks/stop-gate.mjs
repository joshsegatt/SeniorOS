// Claude Code Stop hook: runs the shared finish gate (../../shared/finish-gate.mjs). On a failing check it blocks the
// stop and sends the agent back with the output. Fails open.
import { readFileSync } from 'node:fs';
import { evaluate } from '../../shared/finish-gate.mjs';

export { changeSet } from '../../shared/finish-gate.mjs';

/**
 * Decides whether Claude Code may stop.
 * @param {{ cwd?: string, session_id?: string }} input the Stop hook payload
 * @returns {object | null} a block decision, or null to let the agent finish
 */
export function decide(input) {
  const reason = evaluate({ cwd: input.cwd, sessionId: input.session_id, host: 'claude' });
  return reason ? { decision: 'block', reason } : null;
}

if (/[\\/]claude-code[\\/]hooks[\\/]stop-gate\.mjs$/.test(process.argv[1] ?? '')) {
  try {
    const response = decide(JSON.parse(readFileSync(0, 'utf8') || '{}'));
    if (response) process.stdout.write(JSON.stringify(response));
  } catch {
    // Fail open: the agent may stop.
  }
}
