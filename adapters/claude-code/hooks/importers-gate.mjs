// Experimental, off unless the hook runs with --importers-first: before the first edit of existing source code in a
// session, the agent is sent back once to find who imports and calls what it is about to change. Bugs whose cause sits
// in another module are fixed where they are reported when no one looks at the callers first.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write']);
const SOURCE = /\.(m?[jt]sx?|cjs|cts|py|go|rb|rs|java|kt|cs|php|swift)$/i;
const TEST = /(^|[\\/])(tests?|__tests__|spec)[\\/]|\.(test|spec)\.[^\\/]+$/i;

/**
 * The reason to send the agent back, or null to let the edit through. Marks the session as gated, so it asks once.
 * @param {{ session_id?: string, cwd?: string, tool_name?: string, tool_input?: { file_path?: string } }} input
 * @param {string} stateDir where gated sessions are recorded
 */
export function importersFirst(input, stateDir = path.join(os.tmpdir(), 'senioros-importers-gate')) {
  const file = input?.tool_input?.file_path;
  const session = input?.session_id;
  if (!EDIT_TOOLS.has(input?.tool_name ?? '') || typeof file !== 'string' || typeof session !== 'string') return null;
  if (!SOURCE.test(file) || TEST.test(file)) return null;
  // A new file has no callers yet.
  if (!existsSync(path.resolve(input.cwd ?? '.', file))) return null;
  const marker = path.join(stateDir, session.replace(/[^\w-]/g, '_'));
  if (existsSync(marker)) return null;
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(marker, '');
  return (
    `SeniorOS: before the first code edit of this session, search the repository for the modules that import or call ` +
    `${path.basename(file)} and every other file you plan to change, read the ones that pass data into the code you are ` +
    'changing, and check whether the reported problem starts there. Then make the edit again; this asks only once.'
  );
}
