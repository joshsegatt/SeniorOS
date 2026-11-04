// Claude Code SessionStart hook: gives the agent the SeniorOS routing rules, so the skills are used without the
// user having to name them. Fails open: on any error it adds no context.
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The working directory Claude Code sends on stdin, or the process's own. */
function sessionCwd() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    if (typeof input.cwd === 'string' && input.cwd) return input.cwd;
  } catch {}
  return process.cwd();
}

export const onPath = (name) =>
  (process.env.PATH ?? '').split(delimiter).some((dir) =>
    dir && ['', '.cmd', '.exe'].some((ext) => existsSync(join(dir, name + ext))));

/**
 * Drops the lines that cannot apply to this session: the `.senior/` project state when the folder is not there, and
 * the CLI reference when `senior` is not installed. Each line costs context on every turn of every session.
 * @param {string} rules
 * @param {{ hasSeniorDir: boolean, hasCli: boolean }} env
 */
export function rulesFor(rules, { hasSeniorDir, hasCli }) {
  return rules
    .split('\n')
    .filter((line) => (hasSeniorDir || !line.startsWith('- **Project state:**')) && (hasCli || !line.startsWith('If the `senior` CLI is on PATH')))
    .join('\n');
}

// A suffix match, as the other hooks use: an exact path comparison fails behind a symlink or a different drive-letter
// case, and the session would start without the rules.
if (/[\\/]claude-code[\\/]hooks[\\/]session-start\.mjs$/.test(process.argv[1] ?? '')) {
  try {
    const rules = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'rules.md'), 'utf8');
    const additionalContext = rulesFor(rules, { hasSeniorDir: existsSync(join(sessionCwd(), '.senior')), hasCli: onPath('senior') });
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }));
  } catch {
    // No context is better than a broken session start.
  }
}
