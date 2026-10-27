#!/usr/bin/env node
// SeniorOS live bench: the same model on the same tasks, with no pack vs other packs vs SeniorOS,
// graded by deterministic checks. See evals/bench/README.md.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARMS, applyArm, armState, restoreArms } from './lib/arms.mjs';
import { gradeRun } from './lib/grade.mjs';
import { prepareRun } from './lib/prepare.mjs';
import { buildReport } from './lib/report.mjs';
import { CLAUDE_ARMS } from './lib/claude.mjs';
import { runConversation } from './lib/runner.mjs';
import { BENCH_HOME, BENCH_SRC, GEMINI_HOME, HOOK_LOG, git, loadTasks } from './lib/util.mjs';

const USAGE = `Usage: node evals/bench/bench.mjs <command>

  selftest                      Grade the reference good/bad solutions (validates the grader; no model needed)
  probe                         One live harness check inside Antigravity (run this first)
  run [options]                 Run the bench and write a report
      --arms none,superpowers,senioros   (also: senioros-skills)
      --parallel <n>                     conversations at once within an arm (agentapi only; default 1)
      --tasks core|hard|t1-label,...     (default: all)
      --trials 2
      --backend agentapi|agy|claude|manual (default: agentapi; claude runs "claude -p", arms none|superpowers|senioros)
      --model flash                      (default: flash; haiku for claude)
  report <resultsDir>           Rebuild a report from graded runs
  arm <name>|restore|status     Switch the global Antigravity config by hand (restore puts yours back)
  tasks                         List tasks

Data lives in ${BENCH_HOME}.`;

function option(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

/** `all`, a set name (`core`, `hard`) or a comma-separated list of task ids. */
function pickTasks(list) {
  const all = loadTasks();
  if (!list || list === 'all') return all;
  const sets = new Set(all.map((t) => t.set ?? 'core'));
  if (sets.has(list)) return all.filter((t) => (t.set ?? 'core') === list);
  const ids = list.split(',');
  const unknown = ids.filter((id) => !all.some((t) => t.id === id));
  if (unknown.length) throw new Error(`Unknown task(s): ${unknown.join(', ')}`);
  return all.filter((t) => ids.includes(t.id));
}

async function selftest() {
  let mismatches = 0;
  for (const task of loadTasks()) {
    // noop = the agent changed nothing: must fail, unless doing nothing is the right answer (t6).
    for (const variant of ['good', 'bad', 'noop']) {
      const refDir = join(BENCH_SRC, 'reference', task.id, variant);
      if (variant !== 'noop' && !existsSync(refDir)) { console.log(`MISSING   ${task.id} ${variant}`); mismatches += 1; continue; }
      const meta = prepareRun(task, `selftest-${variant}`, 1);
      if (variant !== 'noop') {
        cpSync(refDir, meta.repo, { recursive: true, force: true, filter: (src) => !src.endsWith('commands.json') });
        const commandsFile = join(refDir, 'commands.json');
        if (existsSync(commandsFile)) {
          for (const args of JSON.parse(readFileSync(commandsFile, 'utf8'))) git(meta.repo, args);
          rmSync(join(meta.repo, 'commands.json'), { force: true });
        }
      }
      const result = gradeRun(meta, task);
      const expected = variant === 'good' || (variant === 'noop' && task.noopPasses === true);
      const ok = result.pass === expected;
      if (!ok) mismatches += 1;
      const why = result.pass ? '' : `  failed: ${result.failed.map((n) => `${n} (${result.checks[n]?.detail})`).join('; ')}`;
      console.log(`${ok ? 'OK      ' : 'MISMATCH'}  ${task.id.padEnd(16)} ${variant.padEnd(4)} graded ${result.pass ? 'PASS' : 'FAIL'}${why}`);
      rmSync(meta.runDir, { recursive: true, force: true });
    }
  }
  console.log(mismatches ? `\n${mismatches} mismatch(es): the grader is not trustworthy yet.` : '\nGrader verified: every good solution passes and every bad one fails.');
  if (mismatches) process.exitCode = 1;
}

async function probe() {
  const token = `BENCH CANARY ${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const skillName = `bench-canary-${Math.random().toString(36).slice(2, 7)}`;
  const probeDir = join(BENCH_HOME, 'probe');
  rmSync(probeDir, { recursive: true, force: true });
  const skillDir = join(probeDir, 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: ${skillName}\ndescription: Harness canary. Use only when asked whether ${skillName} exists.\n---\n\n# Canary\n\nReply "canary loaded".\n`);
  const answerFile = join(probeDir, 'answer.txt').replace(/\\/g, '/');
  const task = {
    id: 'probe',
    timeoutMinutes: 5,
    prompt: [
      'This is a harness check, not a coding task. Do exactly this:',
      '1. Run the terminal command `git --version` and note its output.',
      `2. Check whether your rules/context contain a line starting with "BENCH CANARY". If yes, quote that line.`,
      `3. Check whether a skill named "${skillName}" is available to you (yes/no).`,
      '4. State which folder(s) are your workspace.',
      `5. Write your four answers, one per line, to the file ${answerFile}. Then stop.`,
    ].join('\n'),
  };
  const meta = { runId: 'probe', repo: probeDir };
  const started = new Date().toISOString();
  try {
    applyArm('senioros');
    writeFileSync(join(GEMINI_HOME, 'GEMINI.md'), readFileSync(join(GEMINI_HOME, 'GEMINI.md'), 'utf8') + `\n${token}\n`);
    const skillsJson = join(GEMINI_HOME, 'config', 'skills.json');
    const skills = JSON.parse(readFileSync(skillsJson, 'utf8'));
    skills.entries.push({ path: join(probeDir, 'skills').replace(/\\/g, '/') });
    writeFileSync(skillsJson, JSON.stringify(skills, null, 2));

    console.log('Starting a probe conversation with Flash. This takes up to 5 minutes…');
    const outcome = await runConversation('agentapi', { task, meta, model: option(process.argv, 'model', 'flash') });
    const answer = existsSync(answerFile) ? readFileSync(answerFile, 'utf8').trim() : null;
    const hookLines = existsSync(HOOK_LOG)
      ? readFileSync(HOOK_LOG, 'utf8').split('\n').filter((l) => { try { return Date.parse(JSON.parse(l).at) >= Date.parse(started); } catch { return false; } })
      : [];
    const markerFile = outcome.conversationId ? join(BENCH_HOME, 'markers', `${outcome.conversationId}.jsonl`) : null;
    const markers = markerFile && existsSync(markerFile) ? readFileSync(markerFile, 'utf8').trim() : '(none)';

    const report = [
      '# Bench probe',
      `agentapi output: ${outcome.backendOutput?.trim() || '(empty)'}`,
      `conversation id: ${outcome.conversationId ?? '(not found)'}`,
      `finished: ${outcome.timedOut ? 'NO (timed out)' : 'yes'}`,
      `hooks.json reloaded live (bench-marker fired): ${markers !== '(none)' ? 'yes' : 'NO'}`,
      `marker events:\n${markers}`,
      `SeniorOS adapter hook log during probe:\n${hookLines.join('\n') || '(none)'}`,
      `canary token expected: ${token}`,
      `canary skill expected: ${skillName}`,
      `agent answer:\n${answer ?? '(answer file not written)'}`,
    ].join('\n\n');
    mkdirSync(probeDir, { recursive: true });
    writeFileSync(join(probeDir, 'probe-report.md'), report);
    console.log(`\n${report}\n\nSaved to ${join(probeDir, 'probe-report.md')}`);
  } finally {
    restoreArms();
    console.log('Your Antigravity config was restored.');
  }
}

/** The model provider refused further work (usage limit or rate limit). */
class UsageLimit extends Error {}

/** Runs `worker` over `items`, at most `limit` at a time; the first error stops new work and is rethrown. */
async function pool(items, limit, worker) {
  let next = 0;
  let failure;
  const lane = async () => {
    while (next < items.length && !failure) {
      const item = items[next++];
      try {
        await worker(item);
      } catch (err) {
        failure ??= err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  if (failure) throw failure;
}

async function runBench(args) {
  const arms = option(args, 'arms', 'none,superpowers,senioros').split(',');
  const tasks = pickTasks(option(args, 'tasks', 'all'));
  const trials = Number(option(args, 'trials', '2'));
  const backend = /** @type {any} */ (option(args, 'backend', 'agentapi'));
  // Claude Code arms are per-process flags; every other backend swaps the global Antigravity config.
  const perProcessArms = backend === 'claude';
  const known = perProcessArms ? CLAUDE_ARMS : ARMS;
  for (const a of arms) if (!known[a]) throw new Error(`Unknown arm "${a}" for backend ${backend}`);
  const model = option(args, 'model', perProcessArms ? 'haiku' : 'flash');
  const parallel = Math.max(1, Number(option(args, 'parallel', '1')) || 1);
  if (parallel > 1 && backend !== 'agentapi' && backend !== 'claude') throw new Error('--parallel needs the agentapi or claude backend.');
  const resultsDir = join(BENCH_HOME, 'results', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(resultsDir, { recursive: true });
  const total = trials * tasks.length * arms.length;
  console.log(`Bench: ${tasks.length} task(s) x ${arms.length} arm(s) x ${trials} trial(s) = ${total} runs, backend ${backend}, model ${model}.`);
  if (parallel > 1) console.log(`Parallel: up to ${parallel} conversations at once${perProcessArms ? ', arms interleaved' : ', one arm at a time'}.`);
  console.log(`Results: ${resultsDir}`);

  let done = 0;
  async function runOne(task, arm, trial) {
    const meta = prepareRun(task, arm, trial);
    meta.startedAt = new Date().toISOString();
    let outcome;
    try {
      outcome = await runConversation(backend, { task, meta, model, parallel: parallel > 1 });
    } catch (err) {
      outcome = { error: String(err.message ?? err), timedOut: false };
    }
    meta.finishedAt = new Date().toISOString();
    Object.assign(meta, outcome);
    writeFileSync(join(meta.runDir, 'meta.json'), JSON.stringify(meta, null, 2));
    const result = { ...gradeRun(meta, task), outcome };
    writeFileSync(join(resultsDir, `${meta.runId}.json`), JSON.stringify(result, null, 2));
    done += 1;
    console.log(`[${done}/${total}] ${meta.runId.padEnd(36)} ${result.pass ? 'PASS' : 'FAIL'}${result.pass ? '' : `  (${result.failed.join(', ')})`}${outcome.error ? `  error: ${outcome.error}` : ''}`);
    if (outcome.error && backend === 'agentapi' && /ANTIGRAVITY_LS_ADDRESS|not found/.test(outcome.error)) throw new Error(outcome.error);
    // Every later run would hit the same limit and grade an untouched repository: stop and report what ran.
    if (outcome.error && /usage_limit|rate_limit|\(429\)/.test(outcome.error)) throw new UsageLimit(outcome.error);
  }

  try {
    if (perProcessArms) {
      // No global config to swap: interleave arms so none runs only early or only late.
      const jobs = [];
      for (let trial = 1; trial <= trials; trial++) {
        for (const [ti, task] of tasks.entries()) {
          const shift = (ti + trial) % arms.length;
          for (const arm of [...arms.slice(shift), ...arms.slice(0, shift)]) jobs.push([task, arm, trial]);
        }
      }
      await pool(jobs, parallel, (job) => runOne(...job));
    } else if (parallel > 1) {
      // The arm is global Antigravity config, so arms run one after another; runs within an arm overlap.
      for (const arm of arms) {
        applyArm(arm);
        const jobs = [];
        for (let trial = 1; trial <= trials; trial++) for (const task of tasks) jobs.push([task, arm, trial]);
        await pool(jobs, parallel, (job) => runOne(...job));
      }
    } else {
      for (let trial = 1; trial <= trials; trial++) {
        for (const [ti, task] of tasks.entries()) {
          // Rotate arm order per task and trial so no arm always runs first.
          const shift = (ti + trial) % arms.length;
          for (const arm of [...arms.slice(shift), ...arms.slice(0, shift)]) {
            applyArm(arm);
            await runOne(task, arm, trial);
          }
        }
      }
    }
  } catch (err) {
    if (!(err instanceof UsageLimit)) throw err;
    console.log(`\nStopped after ${done} of ${total} runs: ${err.message}. Runs already started may also show this error; rerun once the limit resets.`);
  } finally {
    if (!perProcessArms) {
      restoreArms();
      console.log('Your Antigravity config was restored.');
    }
  }
  console.log('\n' + buildReport(resultsDir));
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'selftest') await selftest();
  else if (command === 'probe') await probe();
  else if (command === 'run') await runBench(args);
  else if (command === 'report' && args[0]) console.log(buildReport(args[0]));
  else if (command === 'arm' && args[0] === 'restore') console.log(restoreArms() ? 'Restored your Antigravity config.' : 'Nothing to restore.');
  else if (command === 'arm' && args[0] === 'status') console.log(JSON.stringify(armState() ?? { arm: null }, null, 2));
  else if (command === 'arm' && args[0]) { applyArm(args[0]); console.log(`Arm "${args[0]}" applied. Run "arm restore" to put your config back.`); }
  else if (command === 'tasks') for (const t of loadTasks()) console.log(`${(t.set ?? 'core').padEnd(5)} ${t.id.padEnd(17)} ${t.title}: ${t.measures}`);
  else { console.log(USAGE); if (command) process.exitCode = 1; }
} catch (err) {
  console.error(`bench: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
