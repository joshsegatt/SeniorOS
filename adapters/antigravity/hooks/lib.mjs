// Shared helpers for the SeniorOS Antigravity hooks.
//
// Antigravity facts these hooks rely on (verified on Antigravity 44.4.3):
// - A hook command is split on whitespace and run without a shell: quotes stay literal, so paths must be
//   unquoted and contain no spaces. Relative paths resolve from the folder that holds hooks.json.
// - A PreToolUse response without a `decision` DENIES the tool call. Hooks must answer explicitly.
// - Conversations started without a workspace (e.g. through agentapi) have empty `workspacePaths`, so the
//   project is learned from the files the agent edits (see track.mjs).
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Decisions are logged next to the hook scripts; override with SENIOROS_HOOK_LOG. */
export const LOG = process.env.SENIOROS_HOOK_LOG || join(dirname(fileURLToPath(import.meta.url)), 'hooks.log');
/** How to call the SeniorOS CLI (a shell command line); override with SENIOROS_CLI. */
export const SENIOR = process.env.SENIOROS_CLI || 'senior';
const STATE_DIR = join(tmpdir(), 'senioros-agy');
const MAX_ROOTS = 5;

export function log(event, data) {
  try {
    if (existsSync(LOG) && statSync(LOG).size > 1_000_000) renameSync(LOG, LOG + '.old');
    appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), event, ...data }) + '\n');
  } catch {}
}

export function readInput() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function respond(obj) {
  process.stdout.write(JSON.stringify(obj ?? {}));
}

/**
 * Runs a hook body. On any error it answers `fallback`, the response that leaves Antigravity's normal
 * behavior in place for this event (for PreToolUse that must carry a decision, never `{}`).
 */
export async function runHook(event, body, fallback = {}) {
  try {
    respond(await body(readInput()));
  } catch (err) {
    log(event, { error: String(err?.stack ?? err) });
    respond(fallback);
  }
}

export function sh(command, cwd, timeoutMs = 15_000) {
  const r = spawnSync(command, { cwd, shell: true, encoding: 'utf8', timeout: timeoutMs, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '', timedOut: r.error?.code === 'ETIMEDOUT' };
}

function toPath(p) {
  if (typeof p !== 'string' || !p) return null;
  if (p.startsWith('file://')) {
    try { return fileURLToPath(p); } catch { return null; }
  }
  return p;
}

/** Git top-level folder containing `path` (a file or folder), or null outside a repository. */
export function gitRootOf(path) {
  let dir = toPath(path);
  while (dir && !existsSync(dir)) {
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  if (!dir) return null;
  if (!statSync(dir).isDirectory()) dir = dirname(dir);
  const top = sh('git rev-parse --show-toplevel', dir, 5_000);
  return top.code === 0 && top.out.trim() ? top.out.trim() : null;
}

const ABSOLUTE_PATH = /[A-Za-z]:[\\/][^\s"'`;|&<>*?]*|(?<![\w.~-])\/(?:Users|home|workspace|workspaces|mnt|srv|opt|var|tmp|private)\/[^\s"'`;|&<>*?]*/g;

/** Absolute paths mentioned anywhere in a tool call's arguments (file paths, Cwd, `cd` targets…). */
export function pathsInArgs(args) {
  const found = new Set();
  const walk = (value) => {
    if (typeof value === 'string') for (const m of value.matchAll(ABSOLUTE_PATH)) found.add(m[0].replace(/[\\/.,:)]+$/, ''));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(args);
  return [...found];
}

const conversationKey = (input) => String(input.conversationId ?? 'unknown').replace(/[^\w-]/g, '');

export function trackedRoots(input) {
  try { return JSON.parse(readFileSync(join(STATE_DIR, `${conversationKey(input)}.roots.json`), 'utf8')); } catch { return []; }
}

export function addTrackedRoots(input, roots) {
  const merged = [...new Set([...trackedRoots(input), ...roots])].slice(0, MAX_ROOTS);
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(join(STATE_DIR, `${conversationKey(input)}.roots.json`), JSON.stringify(merged));
  } catch {}
  return merged;
}

/**
 * Projects this conversation works on: workspace folders from the payload plus repositories the agent
 * has edited (tracked by track.mjs), resolved to git roots and deduplicated.
 */
export function workspaceRoots(input) {
  const roots = new Map();
  for (const raw of [...(input.workspacePaths ?? []), ...trackedRoots(input)]) {
    const p = toPath(raw);
    if (!p || !existsSync(p)) continue;
    const top = gitRootOf(p);
    const root = top ?? p;
    roots.set(root.toLowerCase(), { root, git: Boolean(top) });
  }
  return [...roots.values()].slice(0, 3);
}

export function tail(text, maxLines, maxChars) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  let out = lines.slice(-maxLines).join('\n');
  if (out.length > maxChars) out = '…' + out.slice(-maxChars);
  return out;
}
