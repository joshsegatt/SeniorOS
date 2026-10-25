import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';

const root = process.cwd();
const skillsDir = path.join(root, 'skills');
const dirs = (await readdir(skillsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory());
let failures = 0;

for (const dir of dirs) {
  const skillPath = path.join(skillsDir, dir.name, 'SKILL.md');
  try {
    const text = await readFile(skillPath, 'utf8');
    const lines = text.split(/\r?\n/);
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatter) throw new Error('missing YAML frontmatter');
    const name = frontmatter[1]?.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (!name) throw new Error('missing name');
    if (!/^[a-z0-9-]{1,64}$/.test(name)) throw new Error(`invalid name: ${name}`);
    if (!description || description.length > 1024) throw new Error('description missing or longer than 1024 characters');
    const bodyLineCount = lines.length - (frontmatter[0]?.split(/\r?\n/).length ?? 0);
    if (bodyLineCount > 500) throw new Error(`body has ${bodyLineCount} lines; keep it <= 500`);
    const details = await stat(skillPath);
    if (details.size === 0) throw new Error('empty SKILL.md');
    console.log(`PASS ${dir.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${dir.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) process.exitCode = 1;
