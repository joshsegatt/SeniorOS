// Bench-only hook, installed in every arm: records when each conversation starts and stops,
// so the runner knows when a run is finished. It never changes the agent's behavior.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const event = process.argv[2] ?? 'unknown';
try {
  const raw = readFileSync(0, 'utf8');
  const input = raw.trim() ? JSON.parse(raw) : {};
  const id = String(input.conversationId ?? 'unknown').replace(/[^\w-]/g, '');
  const dir = join(process.env.SENIOROS_BENCH_HOME || join(homedir(), 'senioros-bench'), 'markers');
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, `${id}.jsonl`), JSON.stringify({
    at: new Date().toISOString(),
    event,
    terminationReason: input.terminationReason,
    workspacePaths: input.workspacePaths,
    modelName: input.modelName,
  }) + '\n');
} catch {}
process.stdout.write('{}');
