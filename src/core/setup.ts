import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { antigravityPaths, installAntigravity } from './antigravity.js';
import { grokPaths, installGrok } from './grok.js';
import { defaultEnvironment, detectHosts, geminiHome, grokHome, onPath, opencodeConfigFiles, opencodeEditBlocked, type HostEnvironment, type HostStatus } from './hosts.js';

export interface SetupReport {
  hosts: HostStatus[];
  /** What `--apply` changed, one line each. */
  applied: string[];
  /** What `--apply` could not do, and why. */
  skipped: string[];
}

/**
 * Adds "senioros" to the user's opencode.json, creating it if needed and backing it up once. A file it cannot rewrite
 * safely (see `opencodeEditBlocked`) is left alone.
 */
export function addOpencodePlugin(e: HostEnvironment): string {
  const blocked = opencodeEditBlocked(e);
  if (blocked) throw new Error(`${blocked}; add "senioros" to its "plugin" list by hand`);
  const { user } = opencodeConfigFiles(e);
  let data: Record<string, unknown> = { $schema: 'https://opencode.ai/config.json' };
  if (existsSync(user)) {
    data = JSON.parse(readFileSync(user, 'utf8')) as Record<string, unknown>;
    const backup = `${user}.bak-senioros`;
    if (!existsSync(backup)) copyFileSync(user, backup);
  }
  data.plugin = [...((data.plugin as unknown[] | undefined) ?? []), 'senioros'];
  mkdirSync(path.dirname(user), { recursive: true });
  writeFileSync(user, JSON.stringify(data, null, 2) + '\n');
  return `added "senioros" to ${user}`;
}

/**
 * The setup steps for each host on this machine; with `apply`, also runs the ones the CLI owns: the Antigravity
 * installer, the Grok installer and the OpenCode plugin entry. Plugins of Claude Code, Codex and Cursor are installed in the app.
 */
export async function setup(root: string, options: { apply?: boolean } = {}, e: HostEnvironment = defaultEnvironment(root)): Promise<SetupReport> {
  const before = detectHosts(root, e);
  const applied: string[] = [];
  const skipped: string[] = [];
  if (options.apply) {
    for (const host of before) {
      if (host.present.state !== 'yes') continue;
      if (host.id === 'opencode') {
        if (host.plugin.state === 'yes') continue;
        if (host.plugin.state === 'unknown') { skipped.push(`OpenCode: ${host.plugin.evidence}; not changed`); continue; }
        try { applied.push(`OpenCode: ${addOpencodePlugin(e)}`); } catch (error) { skipped.push(`OpenCode: ${(error as Error).message}`); }
      } else if (host.id === 'antigravity' && (host.plugin.state !== 'yes' || host.hooks?.state !== 'yes')) {
        try {
          const report = await installAntigravity({}, antigravityPaths(geminiHome(e)));
          applied.push(...report.actions.map((a) => `Antigravity: ${a}`));
          skipped.push(...report.warnings.map((w) => `Antigravity: ${w}`));
        } catch (error) {
          // One host failing must not hide what was already applied to another.
          skipped.push(`Antigravity: the installer failed: ${(error as Error).message}`);
        }
      } else if (host.id === 'grok' && host.steps.length) {
        try {
          const report = await installGrok({ hasCli: Boolean(onPath('senior', e.env)) }, grokPaths(grokHome(e)));
          applied.push(...report.actions.map((a) => `Grok: ${a}`));
          skipped.push(...report.warnings.map((w) => `Grok: ${w}`));
        } catch (error) {
          skipped.push(`Grok: the installer failed: ${(error as Error).message}`);
        }
      }
    }
  }
  return { hosts: applied.length ? detectHosts(root, e) : before, applied, skipped };
}
