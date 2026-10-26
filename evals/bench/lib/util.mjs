// Shared paths and process helpers for the SeniorOS bench.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BENCH_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(BENCH_SRC, '..', '..');
export const FIXTURE = join(BENCH_SRC, 'fixture');
export const TASKS_DIR = join(BENCH_SRC, 'tasks');

/** Where runs, results, markers and config backups live (kept short: Windows paths and git). */
export const BENCH_HOME = process.env.SENIOROS_BENCH_HOME || join(homedir(), 'senioros-bench');
/** The Antigravity customization home. Override to test arm switching against a scratch folder. */
export const GEMINI_HOME = process.env.SENIOROS_BENCH_GEMINI_HOME || join(homedir(), '.gemini');
export const SUPERPOWERS_DIR = process.env.SENIOROS_BENCH_SUPERPOWERS || join(homedir(), 'review-superpowers');
export const HOOK_LOG = join(REPO_ROOT, 'adapters', 'antigravity', 'hooks', 'hooks.log');

/**
 * Runs a program without a shell (arguments are passed verbatim).
 * @param {string} file
 * @param {string[]} args
 * @param {{ cwd?: string, timeoutMs?: number, input?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
export function run(file, args, opts = {}) {
  const r = spawnSync(file, args, {
    cwd: opts.cwd,
    input: opts.input,
    env: opts.env ?? process.env,
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? 60_000,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '', timedOut: r.error?.code === 'ETIMEDOUT', error: r.error };
}

/** git in a repository; throws with stderr when `check` is set and git fails. */
export function git(cwd, args, check = true) {
  const r = run('git', args, { cwd });
  if (check && r.code !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${r.err.trim() || r.out.trim()}`);
  return r;
}

export function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** Newest mtime (ms) of any file under `dir`, ignoring .git and node_modules. */
export function newestMtime(dir) {
  let newest = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === '.git' || name === 'node_modules') continue;
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else newest = Math.max(newest, s.mtimeMs);
    }
  };
  if (existsSync(dir)) walk(dir);
  return newest;
}

/** Repository-relative path with forward slashes. */
export function toPosix(root, file) {
  return relative(root, file).split(sep).join('/');
}

/** Minimal glob: `**` spans folders, `*` stays inside one folder. */
export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
}

/** @returns {Array<Record<string, any>>} task definitions, sorted by id */
export function loadTasks() {
  return readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ ...JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf8')), dir: join(TASKS_DIR, f.replace(/\.json$/, '')) }));
}
