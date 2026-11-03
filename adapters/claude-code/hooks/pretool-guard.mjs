// Claude Code PreToolUse hook (Bash and the file-edit tools): asks for confirmation before destructive or
// irreversible commands, with the same rules as the Antigravity guard, and before an edit to the agent's own settings,
// hooks or plugins. Unflagged commands get no answer, which leaves Claude Code's own permission
// flow in place. Fails open.
import { readFileSync } from 'node:fs';
import { classify, editReason, guardMessage } from '../../shared/guard.mjs';
import { denyMessage } from '../../codex/hooks/guard.mjs';

const SHELL_TOOLS = new Set(['Bash', 'run_terminal_command', 'Shell']);

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
  // Grok loads this plugin too, and names its shell tool `run_terminal_command` (`Shell` under its Cursor preset).
  const reason = SHELL_TOOLS.has(input?.tool_name) || input?.tool_name === undefined
    ? classify(tool.command)
    : editReason([tool.file_path, tool.notebook_path]);
  if (!reason) return null;
  // Grok (its camelCase `hookEventName` is `pre_tool_use`) approves a hook's question by itself under always-approve,
  // so there the command is refused instead, as the Codex guard does.
  const unattended = input?.hookEventName === 'pre_tool_use' && input?.permission_mode === 'bypassPermissions';
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: unattended ? 'deny' : 'ask',
      permissionDecisionReason: unattended ? `${denyMessage(reason)}.` : guardMessage(reason),
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
