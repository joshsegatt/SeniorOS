import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { copyDirSafe } from './fs-utils.js';

export type InstallTarget = 'claude' | 'codex' | 'generic';
export type InstallScope = 'project' | 'user';

function sourceSkillsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../skills');
}

export function destinationFor(root: string, target: InstallTarget, scope: InstallScope): string {
  if (scope === 'user') {
    if (target === 'claude') return path.join(os.homedir(), '.claude', 'skills');
    if (target === 'codex') return path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'skills');
    throw new Error('User-scoped generic install is intentionally undefined. Use --scope project.');
  }

  if (target === 'claude') return path.join(root, '.claude', 'skills');
  if (target === 'codex') return path.join(root, '.codex', 'skills');
  return path.join(root, '.agents', 'skills');
}

export async function installSkills(root: string, target: InstallTarget, scope: InstallScope, force: boolean): Promise<string[]> {
  const source = sourceSkillsDir();
  const destination = destinationFor(root, target, scope);
  const entries = await readdir(source, { withFileTypes: true });
  const installed: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    await copyDirSafe(from, to, force);
    installed.push(to);
  }

  return installed;
}
