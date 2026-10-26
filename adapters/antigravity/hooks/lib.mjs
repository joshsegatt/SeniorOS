// Shared helpers for the SeniorOS Antigravity hooks.
// Every hook fails open: on any error it prints a neutral response so the agent keeps working.
import { appendFileSync, existsSync, readFileSync, statSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Decisions are logged next to the hook scripts; override with SENIOROS_HOOK_LOG. */
export const LOG = process.env.SENIOROS_HOOK_LOG || join(dirname(fileURLToPath(import.meta.url)), 'hooks.log');

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

/** Runs a hook body; any throw becomes a neutral `{}` response. */
export async function runHook(event, body) {
  try {
    respond(await body(readInput()));
  } catch (err) {
    log(event, { error: String(err?.stack ?? err) });
    respond({});
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

/** Workspace folders from the hook payload, resolved to their git roots (deduplicated). */
export function workspaceRoots(input) {
  const roots = new Map();
  for (const raw of input.workspacePaths ?? []) {
    const p = toPath(raw);
    if (!p || !existsSync(p)) continue;
    const top = sh('git rev-parse --show-toplevel', p, 5_000);
    const root = top.code === 0 && top.out.trim() ? top.out.trim() : p;
    roots.set(root.toLowerCase(), { root, git: top.code === 0 });
  }
  return [...roots.values()].slice(0, 3);
}

export function tail(text, maxLines, maxChars) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  let out = lines.slice(-maxLines).join('\n');
  if (out.length > maxChars) out = '…' + out.slice(-maxChars);
  return out;
}
