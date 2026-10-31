// Host-neutral destructive-command guard. The rules live with the Antigravity hooks because the installer copies
// only that folder; every plugin host imports them from here.
import { AGENT_CONFIG_REASON, isAgentConfigPath } from '../antigravity/hooks/guard.mjs';

export { AGENT_CONFIG_REASON, classify, isAgentConfigPath, RULES } from '../antigravity/hooks/guard.mjs';

export const guardMessage = (reason) =>
  `SeniorOS guard: ${reason}. Show the user what would be lost and get explicit confirmation first.`;

/**
 * Files a patch in the `apply_patch` format adds, updates, deletes or moves to.
 * @param {unknown} patch
 * @returns {string[]}
 */
export function patchTargets(patch) {
  if (typeof patch !== 'string') return [];
  return [...patch.matchAll(/^\*\*\* (?:(?:Add|Update|Delete) File|Move to): *(.+?) *$/gm)].map((m) => m[1] ?? '');
}

/**
 * Why a file edit needs the user's confirmation, or null when it may go ahead.
 * @param {Array<unknown>} paths the files the edit writes
 * @returns {string | null}
 */
export function editReason(paths) {
  return paths.some(isAgentConfigPath) ? AGENT_CONFIG_REASON : null;
}
