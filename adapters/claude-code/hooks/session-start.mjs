// Claude Code SessionStart hook: gives the agent the SeniorOS routing rules, so the skills are used without the
// user having to name them. Fails open: on any error it adds no context.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const rules = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'rules.md'), 'utf8');
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: rules } }));
} catch {
  // No context is better than a broken session start.
}
