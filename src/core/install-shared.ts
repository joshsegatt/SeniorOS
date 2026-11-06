import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { exists } from './fs-utils.js';

// Pieces the host installers (Antigravity, Grok) share.

export const RULES_START = '<!-- senioros:start -->';
export const RULES_END = '<!-- senioros:end -->';

export interface InstallReport {
  actions: string[];
  warnings: string[];
}

/** The installed package's root, from `dist/src/core/`. */
export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

/** Copies `file` to `<file>.bak-senioros` once, before the first change an installer makes to it. */
export async function backupOnce(file: string, report: InstallReport): Promise<void> {
  const backup = `${file}.bak-senioros`;
  if ((await exists(file)) && !(await exists(backup))) {
    await copyFile(file, backup);
    report.actions.push(`backed up ${file} to ${backup}`);
  }
}

const count = (text: string, mark: string) => text.split(mark).length - 1;

/** `text` without the installer's rules block, or null when the markers are not one start and one end in order. */
export function stripRulesBlock(text: string): string | null {
  const starts = count(text, RULES_START);
  const ends = count(text, RULES_END);
  if (starts === 0 && ends === 0) return text;
  const start = text.indexOf(RULES_START);
  const end = text.indexOf(RULES_END);
  if (starts !== 1 || ends !== 1 || end < start) return null;
  return (text.slice(0, start).trimEnd() + '\n' + text.slice(end + RULES_END.length).trimStart()).trimEnd() + '\n';
}

const unpairedMarkers = (file: string, todo: string) =>
  `${file} has SeniorOS block markers that do not pair up; left it unchanged (${todo})`;

/**
 * Writes `rules` as the one marked block at the end of `file`, replacing the installer's earlier block and keeping
 * everything else. Leaves the file alone, with a warning, when its markers do not pair up or when it mentions SeniorOS
 * outside a block (unless `force`).
 */
export async function upsertRulesBlock(file: string, rules: string, force: boolean, report: InstallReport): Promise<void> {
  const current = (await exists(file)) ? await readFile(file, 'utf8') : '';
  const base = stripRulesBlock(current);
  if (base === null) {
    report.warnings.push(unpairedMarkers(file, 'fix or remove them, then run the install again'));
    return;
  }
  if (current.includes('SeniorOS') && !current.includes(RULES_START) && !force) {
    report.warnings.push(`${file} already mentions SeniorOS outside an installer block; left it unchanged (run with --force to add the installer's rules as well)`);
    return;
  }
  const kept = base.trimEnd();
  const next = `${kept ? `${kept}\n\n` : ''}${RULES_START}\n${rules.trim()}\n${RULES_END}\n`;
  if (next === current) return;
  await backupOnce(file, report);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, next);
  report.actions.push(`added the SeniorOS rules to ${file}`);
}

/** Removes the installer's rules block from `file`; a file the installer created (no backup) left empty is deleted. */
export async function removeRulesBlock(file: string, report: InstallReport): Promise<void> {
  if (!(await exists(file))) return;
  const current = await readFile(file, 'utf8');
  const next = stripRulesBlock(current);
  if (next === null) {
    report.warnings.push(unpairedMarkers(file, 'remove the rules by hand'));
    return;
  }
  if (next === current) return;
  if (!next.trim() && !(await exists(`${file}.bak-senioros`))) await rm(file);
  else await writeFile(file, next.trim() ? next : '');
  report.actions.push(`removed the SeniorOS rules from ${file}`);
}
