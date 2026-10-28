// Runs the shared finish gate in its own Node process for the OpenCode plugin, so a slow test suite never blocks
// OpenCode's server. Reads {"cwd", "sessionId"} on stdin and writes {"reason"} (null to let the agent finish).
import { readFileSync } from 'node:fs';
import { evaluate } from '../shared/finish-gate.mjs';

let reason = null;
try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  reason = evaluate({ cwd: input.cwd, sessionId: input.sessionId, host: 'opencode' });
} catch {
  // Fail open: the agent may finish.
}
process.stdout.write(JSON.stringify({ reason }));
