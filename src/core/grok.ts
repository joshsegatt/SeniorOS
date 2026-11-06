import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { exists } from './fs-utils.js';
import { onPath } from './hosts.js';

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
export function grokPaths(home = process.env.SENIOROS_GROK_HOME ?? process.env.GROK_HOME ?? path.join(os.homedir(), '.grok')): GrokPaths {
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
const ENABLED = /^(\s*enabled\s*=\s*)\[(.*)\](\s*(#.*)?)$/;
const quoted = (list: string) => [...list.matchAll(/"([^"\\]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? '');

/**
 * `config.toml` with "senioros" added to (`add`) or removed from `[plugins] enabled`. Throws on a layout it cannot
 * edit safely (a dotted `plugins.enabled` key, a list over several lines), so the user edits it by hand.
 */
export function editPluginList(toml: string, add: boolean): string {
  const lines = toml.split('\n');
  if (lines.some((l) => /^\s*plugins\s*\.\s*enabled\s*=/.test(l))) throw new Error('config.toml sets plugins.enabled as a dotted key');
  const start = lines.findIndex((l) => SECTION.test(l));
  if (start === -1) {
    if (!add) return toml;
    const base = toml.replace(/\s*$/, '');
    return `${base ? `${base}\n\n` : ''}[plugins]\nenabled = ["${PLUGIN}"]\n`;
  }
  let end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
  if (end === -1) end = lines.length;
  const at = lines.findIndex((l, i) => i > start && i < end && /^\s*enabled\s*=/.test(l));
  if (at === -1) {
    if (!add) return toml;
    lines.splice(start + 1, 0, `enabled = ["${PLUGIN}"]`);
    return lines.join('\n');
  }
  const m = ENABLED.exec(lines[at] ?? '');
  if (!m) throw new Error('config.toml has a [plugins] enabled list over several lines');
  const items = quoted(m[2] ?? '');
  const has = items.includes(PLUGIN);
  if (add === has) return toml;
  const next = add ? [...items, PLUGIN] : items.filter((i) => i !== PLUGIN);
  lines[at] = `${m[1]}[${next.map((i) => `"${i}"`).join(', ')}]${m[3] ?? ''}`;
  return lines.join('\n');
}

function stripRulesBlock(text: string): string {
  const start = text.indexOf(RULES_START);
  const end = text.indexOf(RULES_END);
  if (start === -1 || end === -1 || end < start) return text;
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
 */
export async function installGrok(options: { force?: boolean; hasCli?: boolean } = {}, paths = grokPaths()): Promise<GrokReport> {
  const report: GrokReport = { actions: [], warnings: [] };
  const source = packageRoot();
  const force = Boolean(options.force);

  // 1. The plugin, a stable copy so an npx cache cleanup cannot break it.
  const foreign = (await exists(paths.plugin)) && !(await exists(path.join(paths.plugin, MARKER)));
  if (foreign && !force) {
    report.warnings.push(`${paths.plugin} was not created by the installer; kept it (run with --force to replace it)`);
  } else {
    await rm(paths.plugin, { recursive: true, force: true });
    for (const part of PARTS) {
      if (!(await exists(path.join(source, part)))) throw new Error(`this SeniorOS package has no ${part}/; reinstall it`);
      await cp(path.join(source, part), path.join(paths.plugin, part), { recursive: true });
    }
    await writeFile(path.join(paths.plugin, MARKER), JSON.stringify({ version: 1 }) + '\n');
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
  const rules = grokRules(await readFile(path.join(source, 'adapters', 'grok', 'rules.md'), 'utf8'), options.hasCli ?? Boolean(onPath('senior')));
  const current = (await exists(paths.agents)) ? await readFile(paths.agents, 'utf8') : '';
  if (current.includes('SeniorOS') && !current.includes(RULES_START) && !force) {
    report.warnings.push(`${paths.agents} already mentions SeniorOS outside an installer block; left it unchanged (run with --force to add the installer's rules as well)`);
  } else {
    const base = stripRulesBlock(current).trimEnd();
    const next = `${base ? `${base}\n\n` : ''}${RULES_START}\n${rules}\n${RULES_END}\n`;
    if (next !== current) {
      await backupOnce(paths.agents, report);
      await mkdir(paths.home, { recursive: true });
      await writeFile(paths.agents, next);
      report.actions.push(`added the SeniorOS rules to ${paths.agents}`);
    }
  }
  return report;
}

/** Removes what `installGrok` added: its plugin folder, the config entry and the rules block. */
export async function uninstallGrok(paths = grokPaths()): Promise<GrokReport> {
  const report: GrokReport = { actions: [], warnings: [] };
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
        await writeFile(paths.config, next);
        report.actions.push(`removed "${PLUGIN}" from ${paths.config}`);
      }
    } catch (error) {
      report.warnings.push(`${(error as Error).message}; remove "${PLUGIN}" from it by hand`);
    }
  }
  if (await exists(paths.agents)) {
    const current = await readFile(paths.agents, 'utf8');
    const next = stripRulesBlock(current);
    if (next !== current) {
      await writeFile(paths.agents, next.trim() ? next : '');
      report.actions.push(`removed the SeniorOS rules from ${paths.agents}`);
    }
  }
  return report;
}
