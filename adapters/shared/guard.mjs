// Host-neutral destructive-command guard. The rules live in the Antigravity guard, because the Antigravity installer
// copies that folder on its own; plugin-based hosts (Claude Code, Cursor) import them from here.
export { classify, RULES } from '../antigravity/hooks/guard.mjs';

/** The message every host shows when a command needs confirmation. */
export const guardMessage = (reason) =>
  `SeniorOS guard: ${reason}. Show the user what would be lost and get explicit confirmation first.`;
