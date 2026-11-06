import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { exists } from './fs-utils.js';

// Grok CLI loads the Claude Code plugin from ~/.grok/plugins/, so the skills, guard and finish gate are the same.
// Its session-start hooks cannot add context, so the routing rules go in ~/.grok/AGENTS.md.

const RULES_START = '<!-- senioros:start -->';
const RULES_END = '<!-- senioros:end -->';
const PLUGIN = 'senioros';
/** The plugin parts Grok needs, as the bench installs them (evals/bench/lib/grok.mjs). */
const PARTS = ['.claude-plugin', 'hooks', 'adapters', 'skills', 'rules'];
const MARKER = '.senioros-install.json';

export interface GrokPaths {
  home: string;
  plugin: string;
  config: string;
  agents: string;
}

export interface GrokReport {
  actions: string[];
  warnings: string[];
}

/** Grok's home: `GROK_HOME` as Grok reads it, else `~/.grok`; `SENIOROS_GROK_HOME` overrides both (tests). */
export function grokHomeDir(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  return env.SENIOROS_GROK_HOME ?? env.GROK_HOME ?? path.join(home, '.grok');
}

export function grokPaths(home = grokHomeDir()): GrokPaths {
  return { home, plugin: path.join(home, 'plugins', PLUGIN), config: path.join(home, 'config.toml'), agents: path.join(home, 'AGENTS.md') };
}

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

async function backupOnce(file: string, report: GrokReport): Promise<void> {
  const backup = `${file}.bak-senioros`;
  if ((await exists(file)) && !(await exists(backup))) {
    await copyFile(file, backup);
    report.actions.push(`backed up ${file} to ${backup}`);
  }
}

const SECTION = /^\s*\[\s*plugins\s*\]\s*(#.*)?$/;
// The list up to its first `]`, so a comment after it (even one with brackets) is kept as written.
const ENABLED = /^(\s*enabled\s*=\s*\[)([^\]]*)(\].*)$/;
const ITEM = /"(?:[^"\\]|\\.)*"|'[^']*'/g;
const unquote = (raw: string) => raw.slice(1, -1);

interface PluginList { lines: string[]; eol: string; start: number; end: number; at: number }

/** Where `[plugins] enabled` is in `config.toml`. Throws on a layout it cannot edit safely. */
function findPluginList(toml: string): PluginList {
  const eol = toml.includes('\r\n') ? '\r\n' : '\n';
  const lines = toml.split(/\r?\n/);
  if (lines.some((l) => /^\s*plugins\s*\.\s*enabled\s*=/.test(l))) throw new Error('config.toml sets plugins.enabled as a dotted key');
  if (lines.some((l) => /^\s*plugins\s*=/.test(l))) throw new Error('config.toml sets plugins as an inline table');
  const start = lines.findIndex((l) => SECTION.test(l));
  if (start === -1) return { lines, eol, start, end: -1, at: -1 };
  let end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
  if (end === -1) end = lines.length;
  const at = lines.findIndex((l, i) => i > start && i < end && /^\s*enabled\s*=/.test(l));
  if (at !== -1 && !ENABLED.test(lines[at] ?? '')) throw new Error('config.toml has a [plugins] enabled list over several lines');
  return { lines, eol, start, end, at };
}

/** True when `config.toml` lists "senioros" in `[plugins] enabled`; false when it does not or cannot be read. */
export function pluginListed(toml: string): boolean {
  try {
    const { lines, at } = findPluginList(toml);
    if (at === -1) return false;
    return [...(ENABLED.exec(lines[at] ?? '')?.[2] ?? '').matchAll(ITEM)].some((m) => unquote(m[0]) === PLUGIN);
  } catch {
    return false;
  }
}

/**
 * `config.toml` with "senioros" added to (`add`) or removed from `[plugins] enabled`, keeping the other entries,
 * comments and line endings as written. Throws on a layout it cannot edit safely (a dotted `plugins.enabled` key, an
 * inline `plugins` table, a list over several lines), so the user edits it by hand.
 */
export function editPluginList(toml: string, add: boolean): string {
  const { lines, eol, start, at } = findPluginList(toml);
  if (start === -1) {
    if (!add) return toml;
    const base = toml.replace(/\s*$/, '');
    return `${base ? `${base}${eol}${eol}` : ''}[plugins]${eol}enabled = ["${PLUGIN}"]${eol}`;
  }
  if (at === -1) {
    if (!add) return toml;
    lines.splice(start + 1, 0, `enabled = ["${PLUGIN}"]`);
    return lines.join(eol);
  }
  const m = ENABLED.exec(lines[at] ?? '') as RegExpExecArray;
  const items = [...(m[2] ?? '').matchAll(ITEM)].map((i) => i[0]);
  const has = items.some((raw) => unquote(raw) === PLUGIN);
  if (add === has) return toml;
  const next = add ? [...items, `"${PLUGIN}"`] : items.filter((raw) => unquote(raw) !== PLUGIN);
  lines[at] = `${m[1]}${next.join(', ')}${m[3]}`;
  return lines.join(eol);
}

const count = (text: string, mark: string) => text.split(mark).length - 1;

/** `text` without the installer's rules block, or null when the markers are not one start and one end in order. */
function stripRulesBlock(text: string): string | null {
  const starts = count(text, RULES_START);
  const ends = count(text, RULES_END);
  if (starts === 0 && ends === 0) return text;
  const start = text.indexOf(RULES_START);
  const end = text.indexOf(RULES_END);
  if (starts !== 1 || ends !== 1 || end < start) return null;
  return (text.slice(0, start).trimEnd() + '\n' + text.slice(end + RULES_END.length).trimStart()).trimEnd() + '\n';
}

/** The Grok rules without the CLI line when `senior` is not installed, as the Claude Code session start drops it. */
export function grokRules(rules: string, hasCli: boolean): string {
  return rules.split('\n').filter((line) => hasCli || !line.startsWith('If the `senior` CLI is on PATH')).join('\n').trim();
}

/**
 * Installs SeniorOS for Grok CLI: the plugin in `plugins/senioros`, the entry in `config.toml` and the rules in a
 * marked block of `AGENTS.md`. Idempotent; changed files are backed up once. Without `force` it never replaces a
 * plugin folder it did not create, or SeniorOS rules outside its block.
 * @param options.hasCli the `senior` CLI is on PATH, so the rules keep the line that names its commands
 */
export async function installGrok(options: { force?: boolean; hasCli: boolean }, paths = grokPaths()): Promise<GrokReport> {
  const report: GrokReport = { actions: [], warnings: [] };
  const source = packageRoot();
  const force = Boolean(options.force);

  // 1. The plugin, a stable copy so an npx cache cleanup cannot break it. Built next to the target and moved into
  // place, so a failure leaves the previous install as it was.
  const foreign = (await exists(paths.plugin)) && !(await exists(path.join(paths.plugin, MARKER)));
  if (foreign && !force) {
    report.warnings.push(`${paths.plugin} was not created by the installer; kept it (run with --force to replace it)`);
  } else {
    for (const part of PARTS) {
      if (!(await exists(path.join(source, part)))) throw new Error(`this SeniorOS package has no ${part}/; reinstall it`);
    }
    const staging = `${paths.plugin}.installing`;
    await rm(staging, { recursive: true, force: true });
    try {
      for (const part of PARTS) await cp(path.join(source, part), path.join(staging, part), { recursive: true });
      await writeFile(path.join(staging, MARKER), JSON.stringify({ version: 1 }) + '\n');
      await rm(paths.plugin, { recursive: true, force: true });
      await rename(staging, paths.plugin);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    report.actions.push(`copied the plugin to ${paths.plugin}`);
  }

  // 2. The plugin entry in config.toml.
  const toml = (await exists(paths.config)) ? await readFile(paths.config, 'utf8') : '';
  try {
    const next = editPluginList(toml, true);
    if (next !== toml) {
      await backupOnce(paths.config, report);
      await mkdir(paths.home, { recursive: true });
      await writeFile(paths.config, next);
      report.actions.push(`enabled "${PLUGIN}" in ${paths.config}`);
    }
  } catch (error) {
    report.warnings.push(`${(error as Error).message}; add "${PLUGIN}" to [plugins] enabled in ${paths.config} by hand`);
  }

  // 3. The rules, one marked block in AGENTS.md, replaced on reinstall.
  const rules = grokRules(await readFile(path.join(source, 'adapters', 'grok', 'rules.md'), 'utf8'), options.hasCli);
  const current = (await exists(paths.agents)) ? await readFile(paths.agents, 'utf8') : '';
  const base = stripRulesBlock(current);
  if (base === null) {
    report.warnings.push(`${paths.agents} has SeniorOS block markers that do not pair up; left it unchanged (fix or remove them, then run the install again)`);
  } else if (current.includes('SeniorOS') && !current.includes(RULES_START) && !force) {
    report.warnings.push(`${paths.agents} already mentions SeniorOS outside an installer block; left it unchanged (run with --force to add the installer's rules as well)`);
  } else {
    const kept = base.trimEnd();
    const next = `${kept ? `${kept}\n\n` : ''}${RULES_START}\n${rules}\n${RULES_END}\n`;
    if (next !== current) {
      await backupOnce(paths.agents, report);
      await mkdir(paths.home, { recursive: true });
      await writeFile(paths.agents, next);
      report.actions.push(`added the SeniorOS rules to ${paths.agents}`);
    }
  }
  return report;
}

/**
 * Removes what `installGrok` added: its plugin folder, the config entry and the rules block. A file the installer
 * created (it has no backup) and that is left with nothing else is removed too.
 */
export async function uninstallGrok(paths = grokPaths()): Promise<GrokReport> {
  const report: GrokReport = { actions: [], warnings: [] };
  const created = async (file: string) => !(await exists(`${file}.bak-senioros`));
  if (await exists(path.join(paths.plugin, MARKER))) {
    await rm(paths.plugin, { recursive: true, force: true });
    report.actions.push(`removed ${paths.plugin}`);
  } else if (await exists(paths.plugin)) {
    report.warnings.push(`${paths.plugin} was not created by the installer; left it`);
  }
  if (await exists(paths.config)) {
    const toml = await readFile(paths.config, 'utf8');
    try {
      const next = editPluginList(toml, false);
      if (next !== toml) {
        if (/^\s*\[plugins\]\s*enabled = \[\]\s*$/.test(next) && (await created(paths.config))) await rm(paths.config);
        else await writeFile(paths.config, next);
        report.actions.push(`removed "${PLUGIN}" from ${paths.config}`);
      }
    } catch (error) {
      report.warnings.push(`${(error as Error).message}; remove "${PLUGIN}" from it by hand`);
    }
  }
  if (await exists(paths.agents)) {
    const current = await readFile(paths.agents, 'utf8');
    const next = stripRulesBlock(current);
    if (next === null) {
      report.warnings.push(`${paths.agents} has SeniorOS block markers that do not pair up; remove the rules by hand`);
    } else if (next !== current) {
      if (!next.trim() && (await created(paths.agents))) await rm(paths.agents);
      else await writeFile(paths.agents, next.trim() ? next : '');
      report.actions.push(`removed the SeniorOS rules from ${paths.agents}`);
    }
  }
  return report;
}
