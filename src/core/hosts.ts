import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { antigravityPaths } from './antigravity.js';

/** `unknown` when the files that would say are missing or unreadable: never a guess. */
export type Tri = 'yes' | 'no' | 'unknown';

export interface Finding {
  state: Tri;
  /** The file or folder that shows it, or why it is unknown. */
  evidence: string;
}

export type HostId = 'claude' | 'codex' | 'cursor' | 'opencode' | 'antigravity';

export interface HostStatus {
  id: HostId;
  name: string;
  /** The host is on this machine: its command is on PATH or its configuration folder exists. */
  present: Finding;
  /** The SeniorOS plugin (or, for Antigravity, the installer) is set up for this host. */
  plugin: Finding;
  /**
   * The hooks that run the guard and the finish gate, where they are separate from the plugin: Codex runs plugin
   * hooks only once the user trusts them, and Antigravity's skills can be registered without the hooks.
   */
  hooks?: Finding & { label: string };
  /** What is left for the user to do, as commands or app steps; empty when nothing is. */
  steps: string[];
}

export interface HostEnvironment {
  home: string;
  env: NodeJS.ProcessEnv;
  /** The project folder, for project-level configuration (OpenCode). */
  root: string;
}

export const defaultEnvironment = (root: string): HostEnvironment => ({ home: os.homedir(), env: process.env, root });

/** Antigravity's folder (`~/.gemini`), as the installer resolves it. */
export const geminiHome = (e: HostEnvironment) => e.env.SENIOROS_GEMINI_HOME ?? path.join(e.home, '.gemini');

const isDir = (p: string) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const read = (p: string): string | null => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
const tilde = (p: string, home: string) => (p.startsWith(home) ? `~${p.slice(home.length)}` : p);

/** A command on PATH, without running it: running a host's binary can open its app. */
export function onPath(command: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['', ...(env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').map((e) => e.toLowerCase())] : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const file = path.join(dir, command + ext);
      try { if (statSync(file).isFile()) return file; } catch {}
    }
  }
  return null;
}

function presence(commands: string[], folder: string, e: HostEnvironment): Finding {
  for (const c of commands) {
    const found = onPath(c, e.env);
    if (found) return { state: 'yes', evidence: `${c} on PATH` };
  }
  if (isDir(folder)) return { state: 'yes', evidence: `${tilde(folder, e.home)} exists` };
  return { state: 'no', evidence: `no ${commands.join(' or ')} on PATH and no ${tilde(folder, e.home)}` };
}

/** A `senioros` folder one level below `dir` (`<cache>/<marketplace>/senioros`), as plugin caches lay them out. */
function cachedPlugin(dir: string): string | null {
  if (!isDir(dir)) return null;
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return null; }
  for (const entry of entries) {
    const candidate = path.join(dir, entry, 'senioros');
    if (isDir(candidate)) return candidate;
  }
  return null;
}

function claude(e: HostEnvironment): HostStatus {
  const config = e.env.CLAUDE_CONFIG_DIR ?? path.join(e.home, '.claude');
  const present = presence(['claude'], config, e);
  const record = path.join(config, 'plugins', 'installed_plugins.json');
  const cache = cachedPlugin(path.join(config, 'plugins', 'cache'));
  let plugin: Finding;
  const text = read(record);
  if (text !== null) {
    // Each install record has a scope; a project-scope install loads only in its own project.
    let installs: Array<{ scope?: unknown; projectPath?: unknown }> | null = null;
    try {
      const data = JSON.parse(text) as { plugins?: Record<string, unknown> };
      installs = Object.entries(data.plugins ?? {})
        .filter(([k]) => /^senioros@/i.test(k))
        .flatMap(([, v]) => (Array.isArray(v) ? v : [v])) as Array<{ scope?: unknown; projectPath?: unknown }>;
    } catch {}
    const key = (p: string) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
    const here = (p: unknown) => typeof p === 'string' && key(p) === key(e.root);
    const loads = installs?.some((i) => (i?.scope !== 'project' && i?.scope !== 'local') || here(i?.projectPath));
    plugin = installs === null
      ? { state: 'unknown', evidence: `${tilde(record, e.home)} could not be read` }
      : loads
        ? { state: 'yes', evidence: tilde(record, e.home) }
        : { state: 'no', evidence: installs.length ? `installed for another project only (${tilde(record, e.home)})` : tilde(record, e.home) };
  } else if (cache) {
    plugin = { state: 'yes', evidence: tilde(cache, e.home) };
  } else {
    plugin = { state: 'unknown', evidence: `no plugin record in ${tilde(path.join(config, 'plugins'), e.home)}` };
  }
  // Installed but turned off in settings.
  if (plugin.state === 'yes') {
    try {
      const settings = JSON.parse(read(path.join(config, 'settings.json')) ?? '{}') as { enabledPlugins?: Record<string, boolean> };
      const off = Object.entries(settings.enabledPlugins ?? {}).find(([k, v]) => /^senioros@/i.test(k) && v === false);
      if (off) plugin = { state: 'no', evidence: `${off[0]} is disabled in ${tilde(path.join(config, 'settings.json'), e.home)}` };
    } catch {}
  }
  const steps = plugin.state === 'yes' ? [] : ['In Claude Code: /plugin marketplace add joshsegatt/SeniorOS', 'In Claude Code: /plugin install senioros@senioros'];
  return { id: 'claude', name: 'Claude Code', present, plugin, steps };
}

/** The plugin's hooks: session start, the guard and the finish gate. */
const CODEX_HOOKS = 3;

/**
 * SeniorOS hooks Codex trusts: `[hooks.state.'<source>:<event>:…']` sections (single or double quoted) that name
 * SeniorOS and hold a `trusted_hash`, wherever it sits in the section.
 */
export function trustedCodexHooks(toml: string): number {
  let count = 0;
  let current: string | null = null;
  let counted = false;
  for (const line of toml.split(/\r?\n/)) {
    const header = /^\s*\[\s*hooks\.state\.(?:'([^']*)'|"((?:[^"\\]|\\.)*)")\s*\]\s*$/.exec(line);
    if (header) { current = header[1] ?? header[2] ?? ''; counted = false; continue; }
    if (/^\s*\[/.test(line)) { current = null; continue; }
    if (current !== null && !counted && /senioros/i.test(current) && /^\s*trusted_hash\s*=/.test(line)) { count++; counted = true; }
  }
  return count;
}

function codex(e: HostEnvironment): HostStatus {
  const home = e.env.CODEX_HOME ?? path.join(e.home, '.codex');
  const present = presence(['codex'], home, e);
  const cacheDir = path.join(home, 'plugins', 'cache');
  const cache = cachedPlugin(cacheDir);
  const plugin: Finding = cache
    ? { state: 'yes', evidence: tilde(cache, e.home) }
    : isDir(cacheDir)
      ? { state: 'no', evidence: `no senioros in ${tilde(cacheDir, e.home)}` }
      : { state: 'unknown', evidence: `no ${tilde(cacheDir, e.home)}` };
  const steps: string[] = [];
  let hooks: HostStatus['hooks'];
  if (plugin.state === 'yes') {
    const file = tilde(path.join(home, 'config.toml'), e.home);
    const trusted = trustedCodexHooks(read(path.join(home, 'config.toml')) ?? '');
    hooks = trusted >= CODEX_HOOKS
      ? { label: 'hooks trusted', state: 'yes', evidence: `${trusted} SeniorOS hooks trusted in ${file}` }
      : trusted > 0
        ? { label: 'hooks trusted', state: 'no', evidence: `${trusted} of the ${CODEX_HOOKS} SeniorOS hooks trusted in ${file}` }
        : { label: 'hooks trusted', state: 'unknown', evidence: `no trusted SeniorOS hook found in ${file}` };
    if (trusted < CODEX_HOOKS) steps.push('In Codex: open /hooks and trust the three SeniorOS hooks');
  } else {
    steps.push('codex plugin marketplace add joshsegatt/SeniorOS', 'codex plugin add senioros@senioros', 'Then in Codex: open /hooks and trust the three SeniorOS hooks');
  }
  return { id: 'codex', name: 'Codex', present, plugin, ...(hooks ? { hooks } : {}), steps };
}

function cursor(e: HostEnvironment): HostStatus {
  const folder = path.join(e.home, '.cursor');
  const present = presence(['cursor', 'cursor-agent'], folder, e);
  const cache = cachedPlugin(path.join(folder, 'plugins'));
  // Where Cursor records a local plugin is not documented, so only a cached copy counts as proof.
  const plugin: Finding = cache
    ? { state: 'yes', evidence: tilde(cache, e.home) }
    : { state: 'unknown', evidence: 'Cursor does not document where it records plugins: check its plugin settings' };
  const steps = plugin.state === 'yes' ? [] : ['In Cursor: /add-plugin senioros, or add a clone of the repository as a local plugin in its plugin settings'];
  return { id: 'cursor', name: 'Cursor', present, plugin, steps };
}

/** OpenCode's configuration files, user level first, then the project's. */
export function opencodeConfigFiles(e: HostEnvironment): { user: string; files: string[] } {
  const configHome = e.env.XDG_CONFIG_HOME ?? path.join(e.home, '.config');
  const user = path.join(configHome, 'opencode', 'opencode.json');
  const files = [user, path.join(configHome, 'opencode', 'opencode.jsonc'), path.join(e.root, 'opencode.json'), path.join(e.root, 'opencode.jsonc')];
  return { user, files };
}

const listsSenioros = (plugins: unknown) => Array.isArray(plugins) && plugins.some((p) => typeof p === 'string' && /^senioros(@|$)/i.test(p));

function opencode(e: HostEnvironment): HostStatus {
  const { files } = opencodeConfigFiles(e);
  const present = presence(['opencode'], path.dirname(files[0] ?? ''), e);
  let plugin: Finding = { state: 'no', evidence: 'no opencode.json lists "senioros"' };
  for (const file of files) {
    const text = read(file);
    if (text === null) continue;
    try {
      // JSONC: drop whole-line comments; a file it still cannot parse is reported as unknown.
      const data = JSON.parse(file.endsWith('.jsonc') ? text.replace(/^\s*\/\/.*$/gm, '') : text) as { plugin?: unknown };
      if (listsSenioros(data.plugin)) { plugin = { state: 'yes', evidence: tilde(file, e.home) }; break; }
    } catch {
      if (plugin.state === 'no') plugin = { state: 'unknown', evidence: `${tilde(file, e.home)} could not be parsed` };
    }
  }
  const blocked = plugin.state === 'yes' ? null : opencodeEditBlocked(e);
  const steps = plugin.state === 'yes'
    ? []
    : blocked
      ? [`Add "senioros" to "plugin" in your OpenCode config by hand (${blocked}), then restart OpenCode`]
      : ['Add "senioros" to "plugin" in opencode.json (senior setup --apply does it), then restart OpenCode'];
  return { id: 'opencode', name: 'OpenCode', present, plugin, steps };
}

/**
 * Why `senior setup --apply` cannot add the plugin to the user's opencode.json, or null when it can: rewriting a
 * JSONC file, or one it cannot parse as an object, would drop what the user wrote.
 */
export function opencodeEditBlocked(e: HostEnvironment): string | null {
  const { user } = opencodeConfigFiles(e);
  if (existsSync(`${user}c`)) return `${tilde(`${user}c`, e.home)} is JSONC`;
  const text = read(user);
  if (text === null) return existsSync(user) ? `${tilde(user, e.home)} cannot be read` : null;
  let data: unknown;
  try { data = JSON.parse(text); } catch { return `${tilde(user, e.home)} is not plain JSON`; }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return `${tilde(user, e.home)} is not a JSON object`;
  const list = (data as { plugin?: unknown }).plugin;
  if (list !== undefined && !Array.isArray(list)) return `"plugin" in ${tilde(user, e.home)} is not a list`;
  return null;
}

function antigravity(e: HostEnvironment): HostStatus {
  const paths = antigravityPaths(geminiHome(e));
  // ~/.gemini is shared with Gemini CLI; Antigravity keeps its own folder inside it.
  const present = presence(['agy', 'antigravity'], path.join(paths.gemini, 'antigravity'), e);
  const manifest = path.join(paths.home, 'install.json');
  let plugin: Finding;
  let registered = false;
  try {
    const data = JSON.parse(read(paths.skillsJson) ?? '{}') as { entries?: Array<{ path?: unknown }> };
    registered = (data.entries ?? []).some((entry) => typeof entry.path === 'string' && /senioros/i.test(entry.path));
  } catch {}
  if (existsSync(manifest)) plugin = { state: 'yes', evidence: tilde(manifest, e.home) };
  else if (registered) plugin = { state: 'yes', evidence: `skills registered by hand in ${tilde(paths.skillsJson, e.home)}` };
  else plugin = { state: 'no', evidence: `no ${tilde(manifest, e.home)}` };
  // The guard and the finish gate are the hooks, which a hand-made setup may lack.
  const guard = /hooks[\\/]+senioros[\\/]+guard\.mjs/.test(read(paths.hooksJson) ?? '');
  const hooks = { label: 'hooks', state: guard ? 'yes' : 'no', evidence: guard ? `SeniorOS guard in ${tilde(paths.hooksJson, e.home)}` : `no SeniorOS guard in ${tilde(paths.hooksJson, e.home)}` } as const;
  const steps = plugin.state === 'yes' && guard ? [] : ['npx senioros install --target antigravity (senior setup --apply does it)'];
  return { id: 'antigravity', name: 'Antigravity', present, plugin, hooks, steps };
}

/** Every host SeniorOS supports, as found on this machine. */
export function detectHosts(root: string, e: HostEnvironment = defaultEnvironment(root)): HostStatus[] {
  return [claude(e), codex(e), cursor(e), opencode(e), antigravity(e)];
}

const MARK: Record<Tri, string> = { yes: 'yes', no: 'no', unknown: 'unknown' };

/** One block per host: whether it is here, the plugin state with its evidence, and the steps left. */
export function formatHosts(hosts: HostStatus[], options: { onlyPresent?: boolean } = {}): string {
  const lines: string[] = [];
  for (const h of hosts) {
    if (options.onlyPresent && h.present.state !== 'yes') continue;
    if (h.present.state !== 'yes') { lines.push(`${h.name}: not found (${h.present.evidence})`); continue; }
    lines.push(`${h.name}: found (${h.present.evidence})`);
    lines.push(`  plugin: ${MARK[h.plugin.state]} (${h.plugin.evidence})`);
    if (h.hooks) lines.push(`  ${h.hooks.label}: ${MARK[h.hooks.state]} (${h.hooks.evidence})`);
    for (const step of h.steps) lines.push(`  next: ${step}`);
  }
  return lines.join('\n');
}
