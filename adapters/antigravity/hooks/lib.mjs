// Shared helpers for the SeniorOS Antigravity hooks.
//
// Antigravity facts these hooks rely on (verified on Antigravity 44.4.3):
// - A hook command is split on whitespace and run without a shell: quotes stay literal, so paths must be
//   unquoted and contain no spaces. Relative paths resolve from the folder that holds hooks.json.
// - A PreToolUse response without a `decision` DENIES the tool call. Hooks must answer explicitly.
// - Conversations started without a workspace (e.g. through agentapi) have empty `workspacePaths`, so the
//   project is learned from the files the agent edits (see track.mjs).
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
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

/** Conversation of the running hook, stamped on every log line so parallel conversations can be told apart. */
let currentConversation;

export function log(event, data) {
  try {
    if (existsSync(LOG) && statSync(LOG).size > 1_000_000) renameSync(LOG, LOG + '.old');
    const entry = { at: new Date().toISOString(), event, ...(currentConversation ? { conversationId: currentConversation } : {}), ...data };
    appendFileSync(LOG, JSON.stringify(entry) + '\n');
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
    const input = readInput();
    if (typeof input.conversationId === 'string') currentConversation = input.conversationId;
    respond(await body(input));
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

// A structured argument whose whole value is one absolute path (it may contain spaces).
const WHOLE_PATH = /^(?:[A-Za-z]:[\\/]|\/)[^\n\r"'`;|&<>*?]*$/;

/** Absolute paths mentioned anywhere in a tool call's arguments (file paths, Cwd, `cd` targets…). */
export function pathsInArgs(args) {
  const found = new Set();
  const walk = (value, key = '') => {
    if (typeof value === 'string') {
      const whole = value.trim();
      if (!/command/i.test(key) && WHOLE_PATH.test(whole)) found.add(whole.replace(/[\\/]+$/, ''));
      else for (const m of value.matchAll(ABSOLUTE_PATH)) found.add(m[0].replace(/[\\/.,:)]+$/, ''));
    } else if (Array.isArray(value)) value.forEach((v) => walk(v, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k));
  };
  walk(args);
  return [...found];
}

const conversationKey = (input) => String(input.conversationId ?? 'unknown').replace(/[^\w-]/g, '');
const rootsFile = (input) => join(STATE_DIR, `${conversationKey(input)}.roots.json`);
const uniq = (list) => [...new Set(list)].slice(0, MAX_ROOTS);

/**
 * Per-conversation repository state: `seen` (any tool touched it), `edited` (a mutating tool changed it)
 * and `injected` (its project context was already given to the agent).
 */
function loadRootState(input) {
  try {
    const s = JSON.parse(readFileSync(rootsFile(input), 'utf8'));
    if (Array.isArray(s)) return { seen: s, edited: s, injected: [] };
    return { seen: s.seen ?? [], edited: s.edited ?? [], injected: s.injected ?? [] };
  } catch {
    return { seen: [], edited: [], injected: [] };
  }
}

function saveRootState(input, state) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(rootsFile(input), JSON.stringify(state));
  } catch {}
}

/** Repositories the agent edited in this conversation. */
export function trackedRoots(input) {
  return loadRootState(input).edited;
}

/** Records repositories a tool call touched; returns the updated state. */
export function recordRoots(input, { seen = [], edited = [] }) {
  const s = loadRootState(input);
  const next = { seen: uniq([...s.seen, ...seen, ...edited]), edited: uniq([...s.edited, ...edited]), injected: s.injected };
  saveRootState(input, next);
  return next;
}

/** Repositories seen but whose context was not given yet; marks them as given. */
export function takeUninjected(input) {
  const s = loadRootState(input);
  const fresh = s.seen.filter((r) => !s.injected.includes(r));
  if (fresh.length) saveRootState(input, { ...s, injected: uniq([...s.injected, ...fresh]) });
  return fresh;
}

export function markInjected(input, roots) {
  const s = loadRootState(input);
  saveRootState(input, { ...s, injected: uniq([...s.injected, ...roots]) });
}

const MAX_DECISIONS_CHARS = 2500;

function decisionsExcerpt(root) {
  const file = join(root, '.senior', 'decisions.md');
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8').replace(/\r/g, '');
  const firstEntry = text.indexOf('\n## ');
  const body = (firstEntry >= 0 ? text.slice(firstEntry + 1) : text).trim();
  if (!body) return null;
  // Newest entries are usually appended last; keep the end when trimming.
  return body.length > MAX_DECISIONS_CHARS ? '…' + body.slice(-MAX_DECISIONS_CHARS) : body;
}

/** One project's context: stack facts, git state and recorded decisions. */
export function projectSection(root, git) {
  const lines = [`### Project: ${root}`];
  const inspect = sh(`${SENIOR} inspect`, root, 10_000);
  if (inspect.code === 0 && inspect.out.trim()) {
    lines.push(inspect.out.trim().split('\n').filter((l) => !/:\s*none detected\s*$/i.test(l) && !/^Root:/.test(l)).join('\n'));
  }
  if (git) {
    const branch = sh('git branch --show-current', root, 5_000).out.trim();
    const dirty = sh('git status --porcelain', root, 10_000).out.split('\n').filter(Boolean).length;
    lines.push(`Git: branch ${branch || '(detached)'}, ${dirty} file(s) with uncommitted changes.`);
  }
  if (existsSync(join(root, '.senior'))) {
    const decisions = decisionsExcerpt(root);
    lines.push(decisions ? `Recorded decisions (.senior/decisions.md); respect them:\n${decisions}` : 'No decisions recorded in .senior/decisions.md.');
  } else {
    lines.push('This project has no .senior/ yet. On the first coding task, suggest that the user run `senior init` (do not run it without approval).');
  }
  return lines.join('\n');
}

export function contextMessage(sections) {
  return [
    'SeniorOS project context (generated by a hook, deterministic):',
    ...sections,
    'Reminder: follow the SeniorOS rules. A stop hook runs `senior finish` when code changed and blocks finishing while a check fails.',
  ].join('\n\n');
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

/**
 * The finish gate's closing instruction. The second time, for code that has not changed since the first report, it
 * tells the agent to stand by an explanation it already gave rather than break a limit the user set (a test the
 * user said not to touch, for example).
 * @param {boolean} again true when the same failing change set was already reported
 */
export function finishGateNextStep(again) {
  const limits =
    'Stay within what the user asked: if the fix needs a change they ruled out (a file, a test, the scope), do not make it.';
  return again
    ? 'The code has not changed since this failure was last reported. If you already explained why it cannot be fixed ' +
        `within what the user asked, repeat that explanation briefly and stop. ${limits} Otherwise fix the root cause ` +
        '(do not weaken or skip tests) and run the checks again.'
    : `Fix the root cause (do not weaken or skip tests) and run the checks again. ${limits} In that case, or if the ` +
        'failure existed before your change, tell the user so with this evidence instead of claiming success.';
}

// Copies of PROJECT_MANIFESTS, IGNORED_DIRS and MAX_DEPTH in src/core/ecosystems.ts, which plans the checks of these
// projects. The installed hooks run without that module; tests/proof-ecosystems.test.ts keeps the copies equal.
export const PROJECT_MANIFESTS = ['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt', 'go.mod', 'Cargo.toml'];
export const IGNORED_DIRS = /^(\..*|node_modules|vendor|third_party|target|build|dist|out|venv|env|__pycache__|site-packages)$/;
export const MAX_DEPTH = 2;

/**
 * True when the finish gate has something to run in this repository: package scripts or a SeniorOS config at the
 * root, or a Python, Go or Rust project at the root or up to two folders below it.
 */
export function hasProofSource(root) {
  if (existsSync(join(root, 'package.json')) || existsSync(join(root, '.senior', 'config.json'))) return true;
  const walk = (dir, depth) => {
    if (PROJECT_MANIFESTS.some((file) => existsSync(join(dir, file)))) return true;
    if (depth >= MAX_DEPTH) return false;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    return entries.some((e) => e.isDirectory() && !IGNORED_DIRS.test(e.name) && walk(join(dir, e.name), depth + 1));
  };
  return walk(root, 0);
}
