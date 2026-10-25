import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { parseSkillManifest } from '../src/core/skill-manifest.js';

const root = process.cwd();
const skillsDir = path.join(root, 'skills');
const dirs = (await readdir(skillsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory());
let failures = 0;

for (const dir of dirs) {
  const skillPath = path.join(skillsDir, dir.name, 'SKILL.md');
  try {
    const text = await readFile(skillPath, 'utf8');
    if (text.trim().length === 0) throw new Error('empty SKILL.md');
    const manifest = parseSkillManifest(text);
    if (manifest.name !== dir.name) throw new Error(`name "${manifest.name}" must match directory "${dir.name}"`);
    console.log(`PASS ${dir.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${dir.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) process.exitCode = 1;
