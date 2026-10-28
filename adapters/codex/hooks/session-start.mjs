// Codex SessionStart hook: adds the SeniorOS routing rules to the session's developer context. Fails open: on any
// error it adds nothing.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function main() {
  try {
    const rules = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'rules.md'), 'utf8');
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: rules } }));
  } catch {
    // No context is better than a broken session start.
  }
}
