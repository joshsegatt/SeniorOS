// Experimental, off unless the hook runs with --importers-first: before the first edit of existing source code in a
// session, the agent is sent back once to find who imports and calls what it is about to change. Bugs whose cause sits
// in another module are fixed where they are reported when no one looks at the callers first.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const EXT = String.raw`\.(?:m?[jt]sx?|cjs|cts|py|go|rb|rs|java|kt|cs|php|swift)`;
const SOURCE = new RegExp(`${EXT}$`, 'i');
const TEST = /(^|[\\/])(tests?|__tests__|spec)[\\/]|\.(test|spec)\.[^\\/]+$/i;
// Agents often edit through the shell: a redirection into a file, or an in-place editor on the files it names.
const REDIRECT = /(?<![\d&])>>?\s*["']?([^\s"'|;&<>]+)/g;
const IN_PLACE = /\bsed\s+(-\w+\s+)*-i|\bperl\s+-\w*i|\btee\b|\bwriteFileSync\b|\bwriteFile\b|\b(Set|Add)-Content\b|\bOut-File\b/i;
const PATHS = new RegExp(String.raw`[\w.~/\\-]+${EXT}\b`, 'gi');

/** The files a tool call writes, as far as its input shows. */
function written(input) {
  const tool = input?.tool_input ?? {};
  if (EDIT_TOOLS.has(input?.tool_name ?? '')) return typeof tool.file_path === 'string' ? [tool.file_path] : [];
  if (!SHELL_TOOLS.has(input?.tool_name ?? '') || typeof tool.command !== 'string') return [];
  const files = [...tool.command.matchAll(REDIRECT)].map((m) => m[1]);
  return IN_PLACE.test(tool.command) ? [...files, ...(tool.command.match(PATHS) ?? [])] : files;
}

/**
 * The reason to send the agent back, or null to let the edit through. Marks the session as gated, so it asks once.
 * @param {{ session_id?: string, cwd?: string, tool_name?: string, tool_input?: { file_path?: string, command?: string } }} input
 * @param {string} stateDir where gated sessions are recorded
 */
export function importersFirst(input, stateDir = path.join(os.tmpdir(), 'senioros-importers-gate')) {
  const session = input?.session_id;
  if (typeof session !== 'string') return null;
  // Existing source code only: a new file has no callers yet.
  const file = written(input).find((f) => SOURCE.test(f) && !TEST.test(f) && existsSync(path.resolve(input.cwd ?? '.', f)));
  if (!file) return null;
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
