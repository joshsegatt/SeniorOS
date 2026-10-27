import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { exists } from './fs-utils.js';

/** Hook blocks this installer owns in `hooks.json`; every other key is left alone. */
const HOOK_KEYS = ['senioros-context', 'senioros-guard', 'senioros-late-context', 'senioros-track', 'senioros-finish-gate'];
const RULES_START = '<!-- senioros:start -->';
const RULES_END = '<!-- senioros:end -->';

export interface AntigravityPaths {
  gemini: string;
  config: string;
  home: string;
  skills: string;
  hooks: string;
  skillsJson: string;
  hooksJson: string;
  rules: string;
}

export interface AntigravityReport {
  actions: string[];
  warnings: string[];
}

/** Antigravity reads its global customizations from `~/.gemini`; `SENIOROS_GEMINI_HOME` overrides it (tests). */
export function antigravityPaths(gemini = process.env.SENIOROS_GEMINI_HOME ?? path.join(os.homedir(), '.gemini')): AntigravityPaths {
  const config = path.join(gemini, 'config');
  const home = path.join(config, 'senioros');
  return {
    gemini,
    config,
    home,
    skills: path.join(home, 'skills'),
    hooks: path.join(config, 'hooks', 'senioros'),
    skillsJson: path.join(config, 'skills.json'),
    hooksJson: path.join(config, 'hooks.json'),
    rules: path.join(gemini, 'GEMINI.md')
  };
}

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

type SkillsJson = { entries?: Array<{ path?: string }> } & Record<string, unknown>;
type HooksJson = Record<string, unknown>;

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  if (!(await exists(file))) return fallback;
  const text = (await readFile(file, 'utf8')).trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${file} is not valid JSON. Fix it or move it away, then run the install again.`);
  }
}

/** Copies `file` to `<file>.bak-senioros` once, before the first change this installer makes to it. */
async function backupOnce(file: string, report: AntigravityReport): Promise<void> {
  const backup = `${file}.bak-senioros`;
  if ((await exists(file)) && !(await exists(backup))) {
    await copyFile(file, backup);
    report.actions.push(`backed up ${file} to ${backup}`);
  }
}

function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

/** Skills entries that already provide SeniorOS skills from somewhere else (a clone or a manual setup). */
async function otherSeniorEntries(entries: Array<{ path?: string }>, ours: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.path) continue;
    const dir = path.resolve(expandHome(entry.path));
    if (dir === path.resolve(ours)) continue;
    if (await exists(path.join(dir, 'senior-engineering', 'SKILL.md'))) found.push(entry.path);
  }
  return found;
}

function stripRulesBlock(text: string): string {
  const start = text.indexOf(RULES_START);
  const end = text.indexOf(RULES_END);
  if (start === -1 || end === -1 || end < start) return text;
  return (text.slice(0, start).trimEnd() + '\n' + text.slice(end + RULES_END.length).trimStart()).trimEnd() + '\n';
}

/**
 * Installs SeniorOS for Google Antigravity: skills, routing rules in GEMINI.md and the lifecycle hooks.
 * Idempotent; files it changes are backed up once; keys and text it does not own are kept.
 * @param options.turbo answer `allow` (not `ask`) for commands the guard does not flag, matching Turbo auto-execution
 */
export async function installAntigravity(options: { turbo?: boolean; force?: boolean } = {}, paths = antigravityPaths()): Promise<AntigravityReport> {
  const report: AntigravityReport = { actions: [], warnings: [] };
  const source = packageRoot();

  // 1. Skills: a stable copy, so an npx cache cleanup cannot break the registration.
  await rm(paths.skills, { recursive: true, force: true });
  await mkdir(paths.skills, { recursive: true });
  for (const entry of await readdir(path.join(source, 'skills'), { withFileTypes: true })) {
    if (entry.isDirectory()) await cp(path.join(source, 'skills', entry.name), path.join(paths.skills, entry.name), { recursive: true });
  }
  report.actions.push(`copied skills to ${paths.skills}`);

  const skillsJson = await readJsonFile<SkillsJson>(paths.skillsJson, {});
  const entries = Array.isArray(skillsJson.entries) ? skillsJson.entries : [];
  const others = await otherSeniorEntries(entries, paths.skills);
  if (others.length && !options.force) {
    report.warnings.push(`skills.json already registers SeniorOS skills from ${others.join(', ')}; kept that entry and did not add a second one (run with --force to switch to the installed copy)`);
  } else {
    const kept = entries.filter((e) => !others.includes(e.path ?? '') && path.resolve(expandHome(e.path ?? '')) !== path.resolve(paths.skills));
    const next = { ...skillsJson, entries: [...kept, { path: paths.skills.replace(/\\/g, '/') }] };
    if (JSON.stringify(next) !== JSON.stringify(skillsJson)) {
      await backupOnce(paths.skillsJson, report);
      await mkdir(paths.config, { recursive: true });
      await writeFile(paths.skillsJson, JSON.stringify(next, null, 2) + '\n');
      report.actions.push(`registered the skills in ${paths.skillsJson}`);
    }
  }

  // 2. Rules: one marked block in GEMINI.md, replaced on reinstall.
  const rules = (await readFile(path.join(source, 'adapters', 'antigravity', 'rules.md'), 'utf8')).trim();
  const current = (await exists(paths.rules)) ? await readFile(paths.rules, 'utf8') : '';
  const unmarked = current.includes('SeniorOS') && !current.includes(RULES_START);
  if (unmarked && !options.force) {
    report.warnings.push(`${paths.rules} already mentions SeniorOS outside an installer block; left it unchanged (run with --force to add the installer's rules as well)`);
  } else {
    const base = stripRulesBlock(current).trimEnd();
    const next = `${base ? `${base}\n\n` : ''}${RULES_START}\n${rules}\n${RULES_END}\n`;
    if (next !== current) {
      await backupOnce(paths.rules, report);
      await mkdir(paths.gemini, { recursive: true });
      await writeFile(paths.rules, next);
      report.actions.push(`added the SeniorOS rules to ${paths.rules}`);
    }
  }

  // 3. Hooks: scripts next to hooks.json (Antigravity resolves relative commands from there), then our named blocks.
  await rm(paths.hooks, { recursive: true, force: true });
  await mkdir(paths.hooks, { recursive: true });
  for (const entry of await readdir(path.join(source, 'adapters', 'antigravity', 'hooks'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.mjs')) await copyFile(path.join(source, 'adapters', 'antigravity', 'hooks', entry.name), path.join(paths.hooks, entry.name));
  }
  report.actions.push(`copied the hooks to ${paths.hooks}`);

  let template = await readFile(path.join(source, 'adapters', 'antigravity', 'hooks.json'), 'utf8');
  if (options.turbo) template = template.replace('--passthrough=ask', '--passthrough=allow');
  const ours = JSON.parse(template) as HooksJson;
  const hooksJson = await readJsonFile<HooksJson>(paths.hooksJson, {});
  const nextHooks: HooksJson = { ...Object.fromEntries(Object.entries(hooksJson).filter(([k]) => !HOOK_KEYS.includes(k))), ...ours };
  if (JSON.stringify(nextHooks) !== JSON.stringify(hooksJson)) {
    await backupOnce(paths.hooksJson, report);
    await writeFile(paths.hooksJson, JSON.stringify(nextHooks, null, 2) + '\n');
    report.actions.push(`added the SeniorOS hooks to ${paths.hooksJson}${options.turbo ? ' (guard passthrough: allow)' : ''}`);
  }

  return report;
}

/** Removes everything `installAntigravity` added, leaving the rest of the Antigravity config as it was. */
export async function uninstallAntigravity(paths = antigravityPaths()): Promise<AntigravityReport> {
  const report: AntigravityReport = { actions: [], warnings: [] };

  if (await exists(paths.skillsJson)) {
    const skillsJson = await readJsonFile<SkillsJson>(paths.skillsJson, {});
    const entries = Array.isArray(skillsJson.entries) ? skillsJson.entries : [];
    const kept = entries.filter((e) => path.resolve(expandHome(e.path ?? '')) !== path.resolve(paths.skills));
    if (kept.length !== entries.length) {
      await writeFile(paths.skillsJson, JSON.stringify({ ...skillsJson, entries: kept }, null, 2) + '\n');
      report.actions.push(`removed the skills entry from ${paths.skillsJson}`);
    }
  }

  if (await exists(paths.rules)) {
    const current = await readFile(paths.rules, 'utf8');
    const next = stripRulesBlock(current);
    if (next !== current) {
      await writeFile(paths.rules, next.trim() ? next : '');
      report.actions.push(`removed the SeniorOS rules from ${paths.rules}`);
    }
  }

  if (await exists(paths.hooksJson)) {
    const hooksJson = await readJsonFile<HooksJson>(paths.hooksJson, {});
    const kept = Object.fromEntries(Object.entries(hooksJson).filter(([k]) => !HOOK_KEYS.includes(k)));
    if (Object.keys(kept).length !== Object.keys(hooksJson).length) {
      await writeFile(paths.hooksJson, JSON.stringify(kept, null, 2) + '\n');
      report.actions.push(`removed the SeniorOS hooks from ${paths.hooksJson}`);
    }
  }

  for (const dir of [paths.hooks, paths.home]) {
    if (await exists(dir)) {
      await rm(dir, { recursive: true, force: true });
      report.actions.push(`deleted ${dir}`);
    }
  }
  return report;
}
