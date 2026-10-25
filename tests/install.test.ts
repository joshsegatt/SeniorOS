import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { destinationFor, findLegacySkills } from '../src/core/install.js';

async function skill(dir: string, name: string, description: string): Promise<void> {
  await mkdir(path.join(dir, name), { recursive: true });
  await writeFile(path.join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
}

test('legacy SeniorOS 0.1 skills are detected by name and original description', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'senior-legacy-'));
  await skill(dir, 'debugging', 'Diagnose software failures by reproducing the problem, tracing evidence.');
  await skill(dir, 'code-review', 'Someone else\'s review skill that happens to share the name.');
  await skill(dir, 'senior-debugging', 'Use when a test fails.');
  assert.deepEqual(await findLegacySkills(dir), [path.join(dir, 'debugging')]);
});

test('legacy detection tolerates a missing skills directory', async () => {
  assert.deepEqual(await findLegacySkills(path.join(os.tmpdir(), 'senior-does-not-exist-xyz')), []);
});

test('every shipped skill uses the senior- prefix', async () => {
  const skillsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills');
  const names = (await readdir(skillsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.ok(names.length >= 6);
  for (const name of names) assert.match(name, /^senior-/);
});

test('claude project skills path', () => {
  assert.equal(destinationFor('/tmp/project', 'claude', 'project'), path.join('/tmp/project', '.claude', 'skills'));
});

test('codex project skills path', () => {
  assert.equal(destinationFor('/tmp/project', 'codex', 'project'), path.join('/tmp/project', '.codex', 'skills'));
});

test('claude user skills path', () => {
  assert.equal(destinationFor('/tmp/project', 'claude', 'user'), path.join(os.homedir(), '.claude', 'skills'));
});
