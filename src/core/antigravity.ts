import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { exists } from './fs-utils.js';

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
 * What the installer added or replaced, so a reinstall never clobbers user changes and an uninstall removes only its
 * own additions. Stored as `install.json` in the installer's own folder.
 */
interface InstallManifest {
  version: 1;
  /** sha256 of every skill file as copied, keyed by path relative to the skills folder. */
  skillFiles: Record<string, string>;
  /** The installer added the skills.json entry. */
  skillsEntry: boolean;
  /** The installer created (or, with --force, replaced) the hook scripts folder. */
  hooksDir: boolean;
  /** Path of the user's hook scripts folder saved before a --force replacement, restored on uninstall. */
  hooksDirBackup?: string;
  /** Hook blocks the installer wrote, as written (without `enabled`), keyed by block name. */
  hookBlocks: Record<string, unknown>;
  /** Pre-existing hook blocks replaced with --force, restored on uninstall. */
  replacedHooks: Record<string, unknown>;
}

const manifestFile = (paths: AntigravityPaths) => path.join(paths.home, 'install.json');

async function readManifest(paths: AntigravityPaths): Promise<InstallManifest | null> {
  const file = manifestFile(paths);
  return (await exists(file)) ? readJsonFile<InstallManifest | null>(file, null) : null;
}

async function hashTree(root: string, rel = ''): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!(await exists(path.join(root, rel)))) return out;
  for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
    const child = path.posix.join(rel.replace(/\\/g, '/'), entry.name);
    if (entry.isDirectory()) Object.assign(out, await hashTree(root, child));
    else if (entry.isFile()) out[child] = createHash('sha256').update(await readFile(path.join(root, child))).digest('hex');
  }
  return out;
}

const sameTree = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

/** A hook block without its user switch, for comparing with what the installer wrote. */
function withoutEnabled(block: unknown): unknown {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return block;
  const { enabled: _enabled, ...rest } = block as Record<string, unknown>;
  return rest;
}

/**
 * Installs SeniorOS for Google Antigravity: skills, routing rules in GEMINI.md and the lifecycle hooks.
 * Idempotent. Files it changes are backed up once. Without `force` it never overwrites something it did not write or
 * that the user changed since: customized skills, hand-made hook blocks and scripts, or SeniorOS rules outside its block.
 * @param options.turbo answer `allow` (not `ask`) for commands the guard does not flag, matching Turbo auto-execution
 */
export async function installAntigravity(options: { turbo?: boolean; force?: boolean } = {}, paths = antigravityPaths()): Promise<AntigravityReport> {
  const report: AntigravityReport = { actions: [], warnings: [] };
  const source = packageRoot();
  const force = Boolean(options.force);
  const previous = await readManifest(paths);
  const manifest: InstallManifest = previous ?? { version: 1, skillFiles: {}, skillsEntry: false, hooksDir: false, hookBlocks: {}, replacedHooks: {} };

  // 1. Skills: a stable copy, so an npx cache cleanup cannot break the registration.
  const installed = await hashTree(paths.skills);
  const untouched = Object.keys(installed).length === 0 || (previous !== null && sameTree(installed, previous.skillFiles));
  if (!untouched && !force) {
    report.warnings.push(`${paths.skills} has changes the installer did not make; kept them and did not update the skills (run with --force to replace them)`);
  } else {
    await rm(paths.skills, { recursive: true, force: true });
    await mkdir(paths.skills, { recursive: true });
    for (const entry of await readdir(path.join(source, 'skills'), { withFileTypes: true })) {
      if (entry.isDirectory()) await cp(path.join(source, 'skills', entry.name), path.join(paths.skills, entry.name), { recursive: true });
    }
    manifest.skillFiles = await hashTree(paths.skills);
    report.actions.push(`copied skills to ${paths.skills}`);
  }

  const skillsJson = await readJsonFile<SkillsJson>(paths.skillsJson, {});
  const entries = Array.isArray(skillsJson.entries) ? skillsJson.entries : [];
  const others = await otherSeniorEntries(entries, paths.skills);
  const ourEntry = entries.some((e) => path.resolve(expandHome(e.path ?? '')) === path.resolve(paths.skills));
  if (others.length && !force) {
    report.warnings.push(`skills.json already registers SeniorOS skills from ${others.join(', ')}; kept that entry and did not add a second one (run with --force to switch to the installed copy)`);
  } else if (!ourEntry || others.length) {
    const kept = entries.filter((e) => !others.includes(e.path ?? ''));
    const next = { ...skillsJson, entries: ourEntry ? kept : [...kept, { path: paths.skills.replace(/\\/g, '/') }] };
    await backupOnce(paths.skillsJson, report);
    await mkdir(paths.config, { recursive: true });
    await writeFile(paths.skillsJson, JSON.stringify(next, null, 2) + '\n');
    if (!ourEntry) manifest.skillsEntry = true;
    report.actions.push(`registered the skills in ${paths.skillsJson}`);
  }

  // 2. Rules: one marked block in GEMINI.md, replaced on reinstall.
  const rules = (await readFile(path.join(source, 'adapters', 'antigravity', 'rules.md'), 'utf8')).trim();
  const current = (await exists(paths.rules)) ? await readFile(paths.rules, 'utf8') : '';
  const unmarked = current.includes('SeniorOS') && !current.includes(RULES_START);
  if (unmarked && !force) {
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

  // 3. Hook scripts, next to hooks.json (Antigravity resolves relative commands from there).
  const scriptsSource = path.join(source, 'adapters', 'antigravity', 'hooks');
  const foreignScripts = (await exists(paths.hooks)) && !manifest.hooksDir;
  if (foreignScripts && !force) {
    report.warnings.push(`${paths.hooks} was not created by the installer; kept those scripts (run with --force to replace them)`);
  } else {
    if (foreignScripts) {
      const backup = `${paths.hooks}.bak-senioros`;
      await rm(backup, { recursive: true, force: true });
      await cp(paths.hooks, backup, { recursive: true });
      manifest.hooksDirBackup = backup;
      report.actions.push(`backed up ${paths.hooks} to ${backup}`);
    }
    await rm(paths.hooks, { recursive: true, force: true });
    await mkdir(paths.hooks, { recursive: true });
    for (const entry of await readdir(scriptsSource, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.mjs')) await copyFile(path.join(scriptsSource, entry.name), path.join(paths.hooks, entry.name));
    }
    manifest.hooksDir = true;
    report.actions.push(`copied the hooks to ${paths.hooks}`);
  }

  // 4. Hook blocks: add missing ones, update the installer's own (keeping `enabled`), leave the user's alone.
  let template = await readFile(path.join(source, 'adapters', 'antigravity', 'hooks.json'), 'utf8');
  if (options.turbo) template = template.replace('--passthrough=ask', '--passthrough=allow');
  const ours = JSON.parse(template) as HooksJson;
  const hooksJson = await readJsonFile<HooksJson>(paths.hooksJson, {});
  const nextHooks: HooksJson = { ...hooksJson };
  const kept: string[] = [];
  for (const [key, block] of Object.entries(ours)) {
    const existing = hooksJson[key];
    const ownedAsWritten = key in manifest.hookBlocks && JSON.stringify(withoutEnabled(existing)) === JSON.stringify(manifest.hookBlocks[key]);
    if (existing !== undefined && !ownedAsWritten && !force) {
      kept.push(key);
      continue;
    }
    if (existing !== undefined && !(key in manifest.hookBlocks)) manifest.replacedHooks[key] = existing;
    const enabled = existing && typeof existing === 'object' ? (existing as Record<string, unknown>).enabled : undefined;
    nextHooks[key] = enabled === undefined ? block : { ...(block as Record<string, unknown>), enabled };
    manifest.hookBlocks[key] = block;
  }
  if (kept.length) report.warnings.push(`kept hook blocks the installer did not write or that were changed since: ${kept.join(', ')} (run with --force to replace them)`);
  if (JSON.stringify(nextHooks) !== JSON.stringify(hooksJson)) {
    await backupOnce(paths.hooksJson, report);
    await writeFile(paths.hooksJson, JSON.stringify(nextHooks, null, 2) + '\n');
    report.actions.push(`added the SeniorOS hooks to ${paths.hooksJson}${options.turbo ? ' (guard passthrough: allow)' : ''}`);
  }

  await mkdir(paths.home, { recursive: true });
  await writeFile(manifestFile(paths), JSON.stringify(manifest, null, 2) + '\n');
  return report;
}

/**
 * Removes what `installAntigravity` added and restores what it replaced with --force, using its manifest. Anything the
 * installer did not write stays, including a SeniorOS setup made by hand.
 */
export async function uninstallAntigravity(paths = antigravityPaths()): Promise<AntigravityReport> {
  const report: AntigravityReport = { actions: [], warnings: [] };
  const manifest = await readManifest(paths);

  if (await exists(paths.rules)) {
    const current = await readFile(paths.rules, 'utf8');
    const next = stripRulesBlock(current);
    if (next !== current) {
      await writeFile(paths.rules, next.trim() ? next : '');
      report.actions.push(`removed the SeniorOS rules from ${paths.rules}`);
    }
  }

  if (!manifest) {
    report.warnings.push(`no installer manifest in ${paths.home}; left skills.json, hooks.json and the hook scripts unchanged`);
    return report;
  }

  if (manifest.skillsEntry && (await exists(paths.skillsJson))) {
    const skillsJson = await readJsonFile<SkillsJson>(paths.skillsJson, {});
    const entries = Array.isArray(skillsJson.entries) ? skillsJson.entries : [];
    const remaining = entries.filter((e) => path.resolve(expandHome(e.path ?? '')) !== path.resolve(paths.skills));
    if (remaining.length !== entries.length) {
      await writeFile(paths.skillsJson, JSON.stringify({ ...skillsJson, entries: remaining }, null, 2) + '\n');
      report.actions.push(`removed the skills entry from ${paths.skillsJson}`);
    }
  }

  if (await exists(paths.hooksJson)) {
    const hooksJson = await readJsonFile<HooksJson>(paths.hooksJson, {});
    const next: HooksJson = { ...hooksJson };
    for (const key of Object.keys(manifest.hookBlocks)) {
      if (!(key in next)) continue;
      if (key in manifest.replacedHooks) next[key] = manifest.replacedHooks[key];
      else delete next[key];
    }
    if (JSON.stringify(next) !== JSON.stringify(hooksJson)) {
      await writeFile(paths.hooksJson, JSON.stringify(next, null, 2) + '\n');
      report.actions.push(`removed the SeniorOS hooks from ${paths.hooksJson}${Object.keys(manifest.replacedHooks).length ? ' and restored the blocks they replaced' : ''}`);
    }
  }

  if (manifest.hooksDir && (await exists(paths.hooks))) {
    await rm(paths.hooks, { recursive: true, force: true });
    report.actions.push(`deleted ${paths.hooks}`);
    if (manifest.hooksDirBackup && (await exists(manifest.hooksDirBackup))) {
      await cp(manifest.hooksDirBackup, paths.hooks, { recursive: true });
      await rm(manifest.hooksDirBackup, { recursive: true, force: true });
      report.actions.push(`restored the previous scripts in ${paths.hooks}`);
    }
  }

  await rm(paths.home, { recursive: true, force: true });
  report.actions.push(`deleted ${paths.home}`);
  return report;
}
