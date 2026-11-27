#!/usr/bin/env node
// SeniorOS improves itself, with proof. One cycle:
//   1. scan     run SeniorOS on a pool of bench tasks (or read a results folder with --from);
//   2. split    tasks it never passed: half to show the proposer (dev), half it never sees (holdout); tasks it always
//               passed become the control;
//   3. propose  a strong model reads the dev failures and the log of earlier attempts, and edits ONE habit into the
//               skill text, in a separate worktree;
//   4. verify   the candidate against the current SeniorOS on dev + holdout + control, same batch;
//   5. decide   adopt only with a dev gain, no holdout loss and no control loss (lib/evolve.mjs `decide`);
//   6. record   every attempt goes to evals/bench/evolution/log.jsonl, won or lost, so no idea is tried twice blind;
//   7. pr       with --pr, an adopted change becomes a draft pull request. Merging stays with a person.
// Usage: node evals/bench/evolve.mjs [--backend claude|codex] [--model sonnet] [--proposer opus] [--pool <ids>|all] [--from <results>]
//          [--trials 2] [--parallel 3] [--budget 25] [--pr]
// Needs what the claude bench needs (a login in CLAUDE_CODE_OAUTH_TOKEN, no user CLAUDE.md reaching the runs).
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BENCH_HOME, REPO_ROOT, loadTasks } from './lib/util.mjs';
import { EDITABLE, decide, failedTestNames, parseHypothesis, proposerPrompt, readLog, readResults, splitScan, tally } from './lib/evolve.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const BACKEND = opt('backend', 'claude');
const MODEL = opt('model', BACKEND === 'codex' ? 'gpt-6.1-sol' : 'sonnet');
const PROPOSER = opt('proposer', 'opus');
const TRIALS = opt('trials', '2');
const PARALLEL = opt('parallel', '3');
const BUDGET = Number(opt('budget', '25'));
const LOG = join(REPO_ROOT, 'evals', 'bench', 'evolution', 'log.jsonl');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const work = join(BENCH_HOME, 'evolve', stamp);
let spent = 0;

// npm is a .cmd on Windows and needs a shell; git and gh are executables and get their arguments unquoted.
const sh = (cmd, args, cwd, env) => spawnSync(cmd, args, { cwd, env: env ?? process.env, encoding: 'utf8', shell: process.platform === 'win32' && cmd === 'npm', maxBuffer: 64 * 1024 * 1024 });

/** Runs one bench batch from `cwd`, echoing its progress, and returns its results folder. */
function bench(cwd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['evals/bench/bench.mjs', 'run', '--backend', BACKEND, '--model', MODEL, ...args], { cwd, env, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    child.on('close', (code) => {
      const dir = /^Results: (.+)$/m.exec(out)?.[1]?.trim();
      if (code !== 0 || !dir) reject(new Error(`bench exited ${code}`));
      else resolve(dir);
    });
  });
}

function record(entry) {
  mkdirSync(join(REPO_ROOT, 'evals', 'bench', 'evolution'), { recursive: true });
  appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), backend: BACKEND, model: MODEL, proposer: PROPOSER, ...entry })}\n`);
  console.log(`\nRecorded in ${LOG}: ${entry.verdict}${entry.reasons?.length ? ` (${entry.reasons.join('; ')})` : ''}`);
}

/** What the proposer gets from one failed run: the request, the failed hidden tests, what the agent did and said. */
function evidence(task, file) {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const repo = join(BENCH_HOME, 'runs', r.runId, 'repo');
  let failedTests = [];
  let changed = [];
  // Run folders are reused by later batches (same task, arm and trial): one newer than the result describes another run.
  const meta = join(BENCH_HOME, 'runs', r.runId, 'meta.json');
  if (existsSync(repo) && existsSync(meta) && statSync(meta).mtimeMs <= statSync(file).mtimeMs) {
    changed = sh('git', ['status', '--porcelain'], repo).stdout.split('\n').filter(Boolean).map((l) => l.slice(3));
    const hidden = join(task.dir, 'hidden');
    if (existsSync(hidden)) {
      const target = join(repo, 'test', '__evolve__');
      cpSync(hidden, target, { recursive: true });
      const { NODE_TEST_CONTEXT: _p, ...env } = process.env;
      // Bonus tests are not graded, so they are not shown as what the user needed.
      const core = readdirSync(hidden).filter((f) => f.endsWith('.test.js') && !f.endsWith('.bonus.test.js')).map((f) => `test/__evolve__/${f}`);
      const t = spawnSync(process.execPath, ['--test', ...core], { cwd: repo, env, encoding: 'utf8', timeout: 120_000 });
      failedTests = failedTestNames(`${t.stdout}\n${t.stderr}`);
      rmSync(target, { recursive: true, force: true });
    }
  }
  return {
    taskId: task.id,
    prompt: [task.prompt, ...(task.followUps ?? [])].join('\n\n(next session)\n'),
    failedTests,
    skillsLoaded: r.outcome?.skillsLoaded ?? [],
    actions: r.outcome?.actions,
    changed,
    finalReport: String(r.outcome?.finalReport ?? '(no report)').slice(0, 2500),
  };
}

async function main() {
  mkdirSync(work, { recursive: true });
  // The candidate is cut from HEAD and the baseline is this working tree: uncommitted skill text would be measured too.
  const dirty = sh('git', ['status', '--porcelain', '--', 'skills', 'rules', 'adapters', 'plugins'], REPO_ROOT).stdout.trim();
  if (dirty) throw new Error(`commit or stash these first, the baseline would include them:\n${dirty}`);
  const tasks = Object.fromEntries(loadTasks().map((t) => [t.id, t]));

  // 1. Scan
  let scanDir = opt('from');
  if (!scanDir) {
    const pool = opt('pool', 'all') === 'all' ? Object.values(tasks).filter((t) => t.set !== 'learn').map((t) => t.id) : opt('pool').split(',');
    console.log(`\n== Scan: SeniorOS on ${pool.length} tasks, 1 trial`);
    scanDir = await bench(REPO_ROOT, ['--arms', 'senioros', '--tasks', pool.join(','), '--trials', '1', '--parallel', PARALLEL]);
  }
  const scan = readResults(scanDir);
  // A scan read with --from was paid for by an earlier run.
  if (!opt('from')) spent += scan.costUsd;
  // 2. Split
  const split = splitScan(scan.byTask, 'senioros', { seed: scanDir });
  console.log(`\n== Split (scan cost $${scan.costUsd.toFixed(2)}): dev ${split.dev.join(' ') || '-'} | holdout ${split.holdout.join(' ') || '-'} | control ${split.control.length} tasks`);
  if (split.dev.length === 0) return record({ verdict: 'nothing-to-evolve', scan: scanDir });

  // Budget: the verify batch is two arms over every chosen task.
  const runsScanned = Object.values(scan.byTask).reduce((n, a) => n + (a.senioros?.runs ?? 0), 0);
  const perRun = runsScanned ? scan.costUsd / runsScanned : 0.2;
  const verifyRuns = 2 * Number(TRIALS) * (split.dev.length + split.holdout.length + split.control.length);
  const estimate = perRun * verifyRuns * 1.2 + 3;
  if (spent + estimate > BUDGET) return record({ verdict: 'over-budget', scan: scanDir, estimate: Number(estimate.toFixed(2)), spent: Number(spent.toFixed(2)) });

  // 3. Propose, in a worktree of the current commit
  const cand = join(work, 'candidate');
  if (sh('git', ['worktree', 'add', '--detach', cand, 'HEAD'], REPO_ROOT).status !== 0) throw new Error('could not create the candidate worktree');
  try {
    const failures = split.dev.map((id) => evidence(tasks[id], scan.byTask[id].senioros.files[0]));
    const prompt = proposerPrompt({ failures, log: readLog(LOG) });
    console.log(`\n== Propose (${PROPOSER}) on ${failures.length} failures`);
    const p = spawnSync('claude', ['-p', '--model', PROPOSER, '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence',
      '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit,Write,Grep,Glob', '--output-format', 'json'],
      { cwd: cand, input: prompt, encoding: 'utf8', timeout: 25 * 60_000, shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
    // A proposer that timed out or crashed may have left a half-written edit: nothing is measured.
    if (p.status !== 0 || p.error) return record({ scan: scanDir, verdict: 'proposer-failed', reasons: [String(p.error?.message ?? `exit ${p.status}${p.signal ? ` ${p.signal}` : ''}`)] });
    let result = {};
    try { result = JSON.parse(p.stdout); } catch {}
    spent += result.total_cost_usd ?? 0;
    const hypothesis = parseHypothesis(result.result) ?? '(no hypothesis line)';
    // New files count as changes too: intent-to-add puts them in the diff, -uall lists them one by one.
    sh('git', ['add', '-N', '.'], cand);
    const files = sh('git', ['status', '--porcelain', '-uall'], cand).stdout.split('\n').filter(Boolean).map((l) => l.slice(3).replace(/\\/g, '/'));
    const diff = sh('git', ['diff'], cand).stdout;
    console.log(`Hypothesis: ${hypothesis}\nFiles: ${files.join(', ') || 'none'}`);
    const base = { scan: scanDir, hypothesis, files, diff: diff.slice(0, 8000), dev: null, split };
    if (files.length === 0) return record({ ...base, verdict: 'no-change' });
    const outside = files.filter((f) => !EDITABLE.test(f));
    if (outside.length) return record({ ...base, verdict: 'rejected', reasons: [`edited outside skill text: ${outside.join(', ')}`] });

    // The copies other hosts load, then the skill validator: a change that breaks the contract is not measured.
    for (const step of [['install', '--silent'], ['run', 'gen:rules'], ['run', 'validate:skills']]) {
      const s = sh('npm', step, cand);
      if (s.status !== 0) return record({ ...base, verdict: 'rejected', reasons: [`npm ${step.join(' ')} failed: ${(s.stdout + s.stderr).slice(-400)}`] });
    }

    // 4. Verify: candidate (`senioros` from the worktree) against current (`senioros-baseline` = this checkout)
    const groups = [...split.dev, ...split.holdout, ...split.control];
    console.log(`\n== Verify on ${groups.length} tasks, ${TRIALS} trials`);
    // Codex has no baseline arm: the current SeniorOS runs as `senioros` from this checkout, in a second batch.
    let vDir;
    let v;
    try {
    if (BACKEND === 'codex') {
      const runs = ['--arms', 'senioros', '--tasks', groups.join(','), '--trials', TRIALS, '--parallel', PARALLEL];
      const cDir = await bench(cand, runs);
      const bDir = await bench(REPO_ROOT, runs);
      const c = readResults(cDir);
      const b = readResults(bDir);
      for (const [task, arms] of Object.entries(b.byTask)) ((c.byTask[task] ??= {})['senioros-baseline'] = arms.senioros);
      vDir = `${cDir} + ${bDir}`;
      v = { byTask: c.byTask, costUsd: c.costUsd + b.costUsd };
    } else {
      vDir = await bench(cand, ['--arms', 'senioros,senioros-baseline', '--tasks', groups.join(','), '--trials', TRIALS, '--parallel', PARALLEL], { ...process.env, SENIOROS_BENCH_BASELINE: REPO_ROOT });
      v = readResults(vDir);
    }
    } catch (e) {
      // The proposal was paid for: a crashed verify still goes to the log, so it is not tried again blind.
      record({ ...base, verdict: 'error', reasons: [String(e.message ?? e)], spent: Number(spent.toFixed(2)) });
      throw e;
    }
    spent += v.costUsd;
    const g = Object.fromEntries(['dev', 'holdout', 'control'].map((k) => [k, { c: tally(v.byTask, split[k], 'senioros'), b: tally(v.byTask, split[k], 'senioros-baseline') }]));
    // 5. Decide
    const d = decide(g);
    console.log(`\nDev ${g.dev.c.pass}/${g.dev.c.runs} vs ${g.dev.b.pass}/${g.dev.b.runs} | holdout ${g.holdout.c.pass}/${g.holdout.c.runs} vs ${g.holdout.b.pass}/${g.holdout.b.runs} | control ${g.control.c.pass}/${g.control.c.runs} vs ${g.control.b.pass}/${g.control.b.runs} | spent $${spent.toFixed(2)}`);
    const entry = { ...base, verify: vDir, ...g, verdict: d.adopt ? 'adopted' : 'lost', reasons: d.reasons, spent: Number(spent.toFixed(2)) };
    record(entry);
    // 7. Pull request
    if (d.adopt && argv.includes('--pr')) {
      const branch = `evolve/${stamp.slice(0, 16)}`;
      // The pull request carries the same log the next local cycle reads.
      cpSync(LOG, join(cand, 'evals', 'bench', 'evolution', 'log.jsonl'));
      for (const args of [['checkout', '-b', branch], ['add', 'skills', 'rules', 'plugins', 'adapters', 'evals/bench/evolution'], ['commit', '-m', `evolve: ${hypothesis.slice(0, 60)}`], ['push', '-u', 'origin', branch]]) {
        const s = sh('git', args, cand);
        if (s.status !== 0) throw new Error(`git ${args[0]} failed: ${s.stderr}`);
      }
      const body = `Found and measured by \`evals/bench/evolve.mjs\` (${MODEL}, proposer ${PROPOSER}).\n\n**Hypothesis:** ${hypothesis}\n\n| Tasks | Candidate | Current |\n|---|---|---|\n| dev (seen) | ${g.dev.c.pass}/${g.dev.c.runs} | ${g.dev.b.pass}/${g.dev.b.runs} |\n| holdout (never seen) | ${g.holdout.c.pass}/${g.holdout.c.runs} | ${g.holdout.b.pass}/${g.holdout.b.runs} |\n| control | ${g.control.c.pass}/${g.control.c.runs} | ${g.control.b.pass}/${g.control.b.runs} |\n\nBench spend: $${spent.toFixed(2)}. Draft: review and run \`npm run check\` before merging.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
      const pr = sh('gh', ['pr', 'create', '--draft', '--base', 'main', '--head', branch, '--title', `evolve: ${hypothesis.slice(0, 70)}`, '--body', body], cand);
      console.log(pr.stdout || pr.stderr);
    }
  } finally {
    if (!argv.includes('--keep')) sh('git', ['worktree', 'remove', '--force', cand], REPO_ROOT);
  }
}

main().catch((e) => {
  console.error(e.stack ?? e);
  process.exitCode = 1;
});
