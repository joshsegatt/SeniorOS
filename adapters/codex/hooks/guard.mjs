// Codex PreToolUse hook (Bash): stops destructive or irreversible commands, with the shared SeniorOS rules.
// Codex has no "ask" answer for this hook (it reports one as a hook error and runs the command), so a flagged command
// is denied and the agent is told to show the user what would be lost; the user runs it themselves once they confirm.
// Unflagged commands get no answer, which leaves Codex's own approval flow in place. Fails open.
import { readFileSync } from 'node:fs';
import { classify } from '../../shared/guard.mjs';

/**
 * Codex appends ". Command: <command>" to this text, so it ends without a period.
 * @param {string} reason
 */
export const denyMessage = (reason) =>
  `SeniorOS guard: ${reason}. This command was not run. Show the user exactly what it would change or lose, and ` +
  'ask them to run it themselves if they confirm. Do not try another command that does the same thing';

/**
 * @param {string} raw the hook's stdin
 * @returns {object | null} the hook response, or null to stay silent
 */
export function decide(raw) {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return null;
  }
  const command = input?.tool_input?.command;
  const reason = classify(Array.isArray(command) ? command.join(' ') : command);
  if (!reason) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: denyMessage(reason),
    },
  };
}

export function main() {
  try {
    const response = decide(readFileSync(0, 'utf8'));
    if (response) process.stdout.write(JSON.stringify(response));
  } catch {
    // Stay silent: Codex's normal approval flow applies.
  }
}
