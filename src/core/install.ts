import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { copyDirSafe } from './fs-utils.js';
import { parseSkillManifest } from './skill-manifest.js';

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

/**
 * Skills shipped by SeniorOS 0.1.0 before the `senior-` prefix. Matched by name AND the
 * original description prefix, so an unrelated skill that happens to share a name is never flagged.
 */
const LEGACY_SKILLS: Record<string, string> = {
  'code-review': 'Review a code change against its goal, correctness, regressions',
  debugging: 'Diagnose software failures by reproducing the problem',
  finish: 'Prove a coding task is actually complete',
  'project-intelligence': 'Build or refresh concise, durable project context',
  'skill-authoring': 'Create or improve a SeniorOS-quality Agent Skill'
};

/** Returns paths of pre-0.2 SeniorOS skills left in a host skills directory (they would trigger twice). */
export async function findLegacySkills(destination: string): Promise<string[]> {
  const found: string[] = [];
  for (const [name, descriptionPrefix] of Object.entries(LEGACY_SKILLS)) {
    const dir = path.join(destination, name);
    try {
      const manifest = parseSkillManifest(await readFile(path.join(dir, 'SKILL.md'), 'utf8'));
      if (manifest.name === name && manifest.description.startsWith(descriptionPrefix)) found.push(dir);
    } catch {
      // Missing or unrelated skill: not ours, leave it alone.
    }
  }
  return found;
}
