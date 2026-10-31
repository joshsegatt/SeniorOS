// Claude Code PreToolUse hook (Bash and the file-edit tools): asks for confirmation before destructive or
// irreversible commands, with the same rules as the Antigravity guard, and before an edit to the agent's own settings,
// hooks or plugins. Unflagged commands get no answer, which leaves Claude Code's own permission
// flow in place. Fails open.
import { readFileSync } from 'node:fs';
import { classify, editReason, guardMessage } from '../../shared/guard.mjs';

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
  const reason = input?.tool_name === 'Bash' || input?.tool_name === undefined
    ? classify(tool.command)
    : editReason([tool.file_path, tool.notebook_path]);
  if (!reason) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: guardMessage(reason),
    },
  };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('claude-code/hooks/pretool-guard.mjs')) {
  try {
    const response = decide(readFileSync(0, 'utf8'));
    if (response) process.stdout.write(JSON.stringify(response));
  } catch {
    // Stay silent: Claude Code's normal permission flow applies.
  }
}
