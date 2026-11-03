// Codex PreToolUse hook (Bash and apply_patch): stops destructive or irreversible commands, with the shared SeniorOS
// rules, and edits to the agent's own settings, hooks or plugins.
// Codex has no "ask" answer for this hook (it reports one as a hook error and runs the command), so a flagged command
// is denied and the agent is told to show the user what would be lost; the user runs it themselves once they confirm.
// Unflagged commands get no answer, which leaves Codex's own approval flow in place. Fails open.
import { readFileSync } from 'node:fs';
import { classify, denyMessage, editReason, patchTargets } from '../../shared/guard.mjs';

export { denyMessage };

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
  const tool = input?.tool_input ?? {};
  const command = Array.isArray(tool.command) ? tool.command.join(' ') : tool.command;
  // apply_patch carries the patch in `command`: judge the files it writes, not its text.
  const reason = input?.tool_name === 'apply_patch'
    ? editReason(patchTargets(command))
    : tool.file_path !== undefined ? editReason([tool.file_path]) : classify(command);
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
