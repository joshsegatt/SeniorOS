// Cursor sessionStart hook: adds the SeniorOS routing rules to the conversation's initial context. Fails open.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function main() {
  try {
    const rules = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'rules.md'), 'utf8');
    process.stdout.write(JSON.stringify({ additional_context: rules }));
  } catch {
    process.stdout.write('{}');
  }
}
