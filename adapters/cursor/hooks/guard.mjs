// Cursor beforeShellExecution hook: asks for confirmation before destructive or irreversible commands, with the
// shared SeniorOS rules. Cursor blocks a command when this hook answers with invalid JSON, so it always answers:
// `ask` for a flagged command, `allow` (no objection; Cursor's own approval still applies) otherwise. Fails open.
import { readFileSync } from 'node:fs';
import { classify, guardMessage } from '../../shared/guard.mjs';

/**
 * @param {string} raw the hook's stdin
 * @returns {{ permission: 'allow' | 'ask', user_message?: string, agent_message?: string }}
 */
export function decide(raw) {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return { permission: 'allow' };
  }
  const reason = classify(input?.command);
  if (!reason) return { permission: 'allow' };
  return { permission: 'ask', user_message: `SeniorOS: ${reason}. Confirm before it runs.`, agent_message: guardMessage(reason) };
}

export function main() {
  let response = { permission: 'allow' };
  try {
    response = decide(readFileSync(0, 'utf8'));
  } catch {}
  process.stdout.write(JSON.stringify(response));
}
