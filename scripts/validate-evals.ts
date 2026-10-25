import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

interface EvalCase {
  id: string;
  skill: string;
  prompt: string;
  expected: {
    shouldTrigger: boolean;
    requiredBehaviors: string[];
    forbiddenBehaviors: string[];
  };
}

const dir = path.join(process.cwd(), 'evals', 'cases');
const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
const perSkill = new Map<string, number>();
let failures = 0;

for (const file of files) {
  try {
    const item = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as EvalCase;
    if (!item.id || !item.skill || !item.prompt) throw new Error('missing id, skill, or prompt');
    if (typeof item.expected?.shouldTrigger !== 'boolean') throw new Error('expected.shouldTrigger must be boolean');
    if (!Array.isArray(item.expected.requiredBehaviors) || !Array.isArray(item.expected.forbiddenBehaviors)) throw new Error('behavior arrays missing');
    perSkill.set(item.skill, (perSkill.get(item.skill) ?? 0) + 1);
    console.log(`PASS ${file}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const [skill, count] of perSkill) {
  if (count < 3) {
    failures += 1;
    console.error(`FAIL ${skill}: only ${count} eval cases; minimum is 3`);
  }
}

if (failures > 0) process.exitCode = 1;
