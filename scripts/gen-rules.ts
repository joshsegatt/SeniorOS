import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The routing rules every host loads come from one template, rules/core.md, so a fix lands in all of them at once.
// Each host fills in only its first line, how skills load there (rules/hosts.json). Antigravity keeps its own
// hand-written rules (it was measured with that wording); tests/rules-sync.test.ts checks its routing parts.

/** Every generated rules file, by path from the repository root, with its content. */
export function renderRules(root: string): Map<string, string> {
  const template = readFileSync(path.join(root, 'rules', 'core.md'), 'utf8');
  if (template.split('{{skills}}').length !== 2) throw new Error('rules/core.md must hold exactly one {{skills}} line');
  const hosts = JSON.parse(readFileSync(path.join(root, 'rules', 'hosts.json'), 'utf8')) as Record<string, string>;
  return new Map(Object.entries(hosts).map(([file, skills]) => [file, template.split('{{skills}}').join(skills)]));
}

/** Writes the generated files; with `check`, only lists the ones that differ from the template. */
export function generateRules(root: string, check = false): string[] {
  const stale: string[] = [];
  for (const [file, content] of renderRules(root)) {
    const target = path.join(root, file);
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; // a missing file is stale; others are errors
    }
    if (current === content) continue;
    stale.push(file);
    if (!check) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
  }
  return stale;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const stale = generateRules(process.cwd(), check);
  if (check && stale.length) {
    console.error(`Out of date with rules/core.md: ${stale.join(', ')}. Edit rules/core.md or rules/hosts.json, then run npm run gen:rules.`);
    process.exitCode = 1;
  } else {
    console.log(stale.length ? `${check ? 'Stale' : 'Wrote'}: ${stale.join(', ')}` : 'Rules up to date.');
  }
}
