// Drives one agent conversation per run through a backend, then waits until the agent is done.
//
// Backends:
//   agentapi  Antigravity's own `agentapi` (only works from a terminal inside an Antigravity conversation,
//             where ANTIGRAVITY_LS_ADDRESS is set). Completion is detected through the bench-marker Stop hook.
//   agy       The Antigravity CLI (`agy -p <prompt>`), run inside the run's repository. Completion = exit.
//   manual    Prints the prompt and waits for Enter: you run the conversation yourself.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { BENCH_HOME, newestMtime, run } from './util.mjs';

// Quiet time after the last Stop before a run counts as finished (a finish gate may send the agent back).
const SETTLE_MS = Number(process.env.SENIOROS_BENCH_SETTLE_MS ?? 30_000);
const POLL_MS = Math.min(5_000, SETTLE_MS);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The prompt every arm receives; identical across arms. */
export function promptFor(task, repo) {
  return `Work only inside the git repository at ${repo}. It is the project for this task.\n\n${task.prompt}`;
}

function languageServer() {
  const candidates = [
    process.env.SENIOROS_BENCH_LS_EXE,
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Antigravity', 'resources', 'bin', 'language_server.exe'),
    '/Applications/Antigravity.app/Contents/Resources/bin/language_server',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Antigravity language_server not found. Set SENIOROS_BENCH_LS_EXE.');
  return found;
}

/** Finds a conversation id in agentapi output: a `conversationId`-like JSON field, else the first UUID. */
export function conversationIdFrom(output) {
  try {
    const stack = [JSON.parse(output)];
    while (stack.length) {
      const value = stack.pop();
      if (!value || typeof value !== 'object') continue;
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string' && /^(conversation|cascade|trajectory)?[_-]?id$/i.test(k)) return v;
        stack.push(v);
      }
    }
  } catch {}
  return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(output)?.[0] ?? null;
}

function markerEvents(conversationId) {
  const file = join(BENCH_HOME, 'markers', `${conversationId}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** Newest marker file written since `sinceMs` (fallback when agentapi output has no id). */
function newestMarkerSince(sinceMs) {
  const dir = join(BENCH_HOME, 'markers');
  if (!existsSync(dir)) return null;
  const fresh = readdirSync(dir)
    .map((f) => ({ id: f.replace(/\.jsonl$/, ''), mtime: statSync(join(dir, f)).mtimeMs }))
    .filter((f) => f.mtime >= sinceMs)
    .sort((a, b) => b.mtime - a.mtime);
  return fresh[0]?.id ?? null;
}

async function waitForStop(getId, repo, deadline) {
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const id = getId();
    if (!id) continue;
    const stops = markerEvents(id).filter((e) => e.event === 'Stop');
    const last = stops.at(-1);
    if (!last) continue;
    const lastStop = Date.parse(last.at);
    if (Date.now() - lastStop >= SETTLE_MS && newestMtime(repo) <= lastStop + 1_000) {
      return { timedOut: false, conversationId: id, stops: stops.length, terminationReason: last.terminationReason, workspacePaths: last.workspacePaths };
    }
  }
  return { timedOut: true, conversationId: getId() };
}

/**
 * @param {'agentapi' | 'agy' | 'manual'} backend
 * @param {{ task: Record<string, any>, meta: Record<string, any>, model: string }} job
 */
export async function runConversation(backend, { task, meta, model }) {
  const prompt = promptFor(task, meta.repo);
  const timeoutMs = (task.timeoutMinutes ?? 10) * 60_000;
  const started = Date.now();

  if (backend === 'agentapi') {
    if (!process.env.ANTIGRAVITY_LS_ADDRESS) {
      throw new Error('ANTIGRAVITY_LS_ADDRESS is not set: run the bench from a terminal inside an Antigravity conversation, or use --backend agy|manual.');
    }
    const title = `SeniorOS bench ${meta.runId}`;
    const r = run(languageServer(), ['agentapi', 'new-conversation', `--model=${model}`, `--title=${title}`, prompt], { timeoutMs: 60_000 });
    if (r.code !== 0) throw new Error(`agentapi new-conversation failed (exit ${r.code}): ${(r.err || r.out).trim()}`);
    const parsedId = conversationIdFrom(r.out);
    const wait = await waitForStop(() => parsedId ?? newestMarkerSince(started), meta.repo, started + timeoutMs);
    return { ...wait, backendOutput: r.out.slice(0, 2000) };
  }

  if (backend === 'agy') {
    const args = (process.env.SENIOROS_BENCH_AGY_ARGS ?? `-p --model ${model}`).split(' ').filter(Boolean);
    const r = run(process.env.SENIOROS_BENCH_AGY ?? 'agy', [...args, prompt], { cwd: meta.repo, timeoutMs });
    if (r.error && !r.timedOut) throw new Error(`could not run agy: ${r.error.message}`);
    return { timedOut: r.timedOut, exitCode: r.code, backendOutput: (r.out + r.err).slice(-4000) };
  }

  if (backend === 'manual') {
    console.log(`\n=== ${meta.runId} ===\nOpen a NEW conversation (model: ${model}) with ${meta.repo} as the workspace and send:\n\n${prompt}\n`);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('Press Enter when the agent has finished… ');
    rl.close();
    return { timedOut: false };
  }

  throw new Error(`Unknown backend "${backend}"`);
}
