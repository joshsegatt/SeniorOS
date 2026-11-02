import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { antigravityPaths, installAntigravity } from './antigravity.js';
import { detectHosts, opencodeConfigFiles, type HostEnvironment, type HostStatus } from './hosts.js';

export interface SetupReport {
  hosts: HostStatus[];
  /** What `--apply` changed, one line each. */
  applied: string[];
  /** What `--apply` could not do, and why. */
  skipped: string[];
}

/**
 * Adds "senioros" to the user's opencode.json, creating it if needed. A file that is not plain JSON (comments, a
 * .jsonc file) is left alone: rewriting it would drop what the user wrote.
 */
export function addOpencodePlugin(e: HostEnvironment): string {
  const { user } = opencodeConfigFiles(e);
  if (existsSync(`${user}c`)) throw new Error(`${user}c is JSONC; add "senioros" to its "plugin" list by hand`);
  let data: Record<string, unknown> = { $schema: 'https://opencode.ai/config.json' };
  if (existsSync(user)) {
    try {
      data = JSON.parse(readFileSync(user, 'utf8')) as Record<string, unknown>;
    } catch {
      throw new Error(`${user} is not plain JSON; add "senioros" to its "plugin" list by hand`);
    }
    if (data.plugin !== undefined && !Array.isArray(data.plugin)) throw new Error(`"plugin" in ${user} is not a list; add "senioros" by hand`);
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
 * installer and the OpenCode plugin entry. Plugins of Claude Code, Codex and Cursor are installed in the app.
 */
export async function setup(root: string, options: { apply?: boolean } = {}, e: HostEnvironment = { home: os.homedir(), env: process.env, root }): Promise<SetupReport> {
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
        const report = await installAntigravity({}, antigravityPaths(e.env.SENIOROS_GEMINI_HOME ?? path.join(e.home, '.gemini')));
        applied.push(...report.actions.map((a) => `Antigravity: ${a}`));
        skipped.push(...report.warnings.map((w) => `Antigravity: ${w}`));
      }
    }
  }
  return { hosts: applied.length ? detectHosts(root, e) : before, applied, skipped };
}
