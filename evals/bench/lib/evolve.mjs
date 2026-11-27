// Pure parts of `evolve.mjs`: reading a results folder, choosing what to evolve on, the proposer's brief and the
// adoption rule. Kept free of processes and network so they can be tested.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pass counts per task and arm in a results folder, with the run files and their cost.
 * @param {string} dir
 * @returns {{ byTask: Record<string, Record<string, { pass: number, runs: number, files: string[] }>>, costUsd: number }}
 */
export function readResults(dir) {
  const byTask = {};
  let costUsd = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x.includes('--'))) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    // A run that died on the API (overload, usage limit) says nothing about the pack: it is left out.
    if (/API error/i.test(String(r.outcome?.error ?? ''))) continue;
    costUsd += r.outcome?.costUsd ?? 0;
    const cell = ((byTask[r.taskId] ??= {})[r.arm] ??= { pass: 0, runs: 0, files: [] });
    cell.runs += 1;
    if (r.pass) cell.pass += 1;
    cell.files.push(join(dir, f));
  }
  return { byTask, costUsd };
}

/** A small deterministic shuffle, so the same scan always splits the same way. */
export function shuffle(items, seed) {
  const out = [...items];
  let s = [...String(seed)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * From a scan of one arm: tasks it never passed are split into the ones the proposer sees (dev) and the ones it never
 * sees (holdout); tasks it always passed become the control, which the change must not break.
 * @param {Record<string, Record<string, { pass: number, runs: number }>>} byTask
 * @param {string} arm
 * @param {{ seed: string, maxControl?: number, maxDev?: number }} opts
 */
export function splitScan(byTask, arm, { seed, maxControl = 8, maxDev = 6 }) {
  const failed = [];
  const passed = [];
  for (const [task, arms] of Object.entries(byTask)) {
    const cell = arms[arm];
    if (!cell?.runs) continue;
    if (cell.pass === 0) failed.push(task);
    else if (cell.pass === cell.runs) passed.push(task);
  }
  const f = shuffle(failed.sort(), seed);
  const half = Math.ceil(f.length / 2);
  return {
    dev: f.slice(0, Math.min(half, maxDev)),
    holdout: f.slice(half, half + maxDev),
    control: shuffle(passed.sort(), seed).slice(0, maxControl),
  };
}

/**
 * Pass counts of two arms over a group of tasks.
 * @param {Record<string, Record<string, { pass: number, runs: number }>>} byTask
 */
export function tally(byTask, tasks, arm) {
  let pass = 0;
  let runs = 0;
  for (const t of tasks) {
    pass += byTask[t]?.[arm]?.pass ?? 0;
    runs += byTask[t]?.[arm]?.runs ?? 0;
  }
  return { pass, runs };
}

/**
 * The adoption rule. The candidate must win on the tasks the proposer saw by at least `minGain` passes (and by a
 * quarter of the runs, so a larger batch needs a larger gain), must not lose on the tasks it never saw, and must not
 * break the control. A holdout gain is what shows the change is general rather than fitted to the dev tasks.
 * @param {{ dev: {c: {pass:number,runs:number}, b: {pass:number,runs:number}}, holdout: {c: {pass:number,runs:number}, b: {pass:number,runs:number}}, control: {c: {pass:number,runs:number}, b: {pass:number,runs:number}} }} g
 */
export function decide(g, { minGain = 2 } = {}) {
  const devGain = g.dev.c.pass - g.dev.b.pass;
  const need = Math.max(minGain, Math.ceil(g.dev.c.runs / 4));
  const reasons = [];
  if (g.dev.c.runs === 0) reasons.push('no dev runs');
  // A run lost to the API on one side makes raw counts incomparable: no verdict rather than a wrong one.
  for (const k of ['dev', 'holdout', 'control']) if (g[k].c.runs !== g[k].b.runs) reasons.push(`${k} runs differ: ${g[k].c.runs} vs ${g[k].b.runs}`);
  if (devGain < need) reasons.push(`dev gain ${devGain} < ${need}`);
  if (g.holdout.c.pass < g.holdout.b.pass) reasons.push(`holdout ${g.holdout.c.pass} < ${g.holdout.b.pass}`);
  if (g.control.c.pass < g.control.b.pass) reasons.push(`control ${g.control.c.pass} < ${g.control.b.pass}`);
  return { adopt: reasons.length === 0, devGain, holdoutGain: g.holdout.c.pass - g.holdout.b.pass, reasons };
}

/** Only skill and rule text may change: the CLI, hooks and bench stay as they are, so the bench stays a fair judge. */
export const EDITABLE = /^(skills\/[^/]+\/SKILL\.md|skills\/[^/]+\/references\/[^/]+\.md|rules\/core\.md)$/;

/**
 * The proposer's brief: the failures, what earlier attempts tried and how they did, and the limits of the change.
 * @param {{ failures: Array<Record<string, any>>, log: Array<Record<string, any>> }} input
 */
export function proposerPrompt({ failures, log }) {
  const tried = log.length
    ? log.slice(-12).map((e) => `- ${e.verdict.toUpperCase()}: ${e.hypothesis} (dev ${e.dev?.c?.pass}/${e.dev?.c?.runs} vs ${e.dev?.b?.pass}/${e.dev?.b?.runs}${e.reasons?.length ? `; ${e.reasons.join(', ')}` : ''})`).join('\n')
    : '- none yet';
  const cases = failures.map((f, i) => [
    `### Failure ${i + 1}: ${f.taskId}`,
    `User request:\n${f.prompt}`,
    `Hidden tests that failed (what the user actually needed):\n${f.failedTests.map((t) => `- ${t}`).join('\n') || '- (names unavailable)'}`,
    `Skills the agent loaded: ${f.skillsLoaded.join(', ') || 'none'}; tool calls: ${f.actions ?? '?'}`,
    `Files it changed: ${f.changed.join(', ') || 'none'}`,
    `Its final report:\n${f.finalReport}`,
  ].join('\n\n')).join('\n\n');
  return `You improve SeniorOS, a set of skills and rules that coding agents load (this repository). Agents using it
failed the tasks below. Your job: find the ONE habit or rule whose absence explains most of these failures, and make
the smallest change to the skill text that would make an agent do it.

Rules for the change:
- Edit only skills/*/SKILL.md, skills/*/references/*.md or rules/core.md. Nothing else.
- One idea, a few lines. A rule buried in a long paragraph gets skipped: prefer its own numbered step, a red-flag row,
  or a line the report must fill. Keep SKILL.md under 500 lines and 20,000 bytes.
- Write a GENERAL habit that would help on other projects, not a hint about these tasks: the change is tested on
  other tasks it never saw, and it is rejected if it does not help there or breaks the passing ones.
- Do not repeat an idea that already lost below; build on what won.
- Do not touch tests, hooks, the CLI or evals/.

Earlier attempts:
${tried}

${cases}

When the edit is made, end your reply with one line of JSON and nothing after it:
{"hypothesis": "<one sentence: the missing habit and why it explains the failures>"}`;
}

/** The hypothesis line the proposer ends with, or null. */
export function parseHypothesis(text) {
  const lines = String(text ?? '').trim().split(/\r?\n/).reverse();
  for (const line of lines) {
    const m = /\{\s*"hypothesis"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/.exec(line);
    if (m) return JSON.parse(`"${m[1]}"`);
  }
  return null;
}

/** Names of the failed tests in `node --test` output. */
export function failedTestNames(output) {
  const names = new Set();
  let inSummary = false;
  for (const raw of String(output).split(/\r?\n/)) {
    const line = raw.trim();
    if (/^✖ failing tests:/.test(line)) { inSummary = true; continue; }
    const m = /^✖ (.+?)(?: \([\d.]+m?s\))?$/.exec(line);
    if (m && !inSummary) names.add(m[1]);
  }
  return [...names];
}

/** The evolution log: one JSON line per attempt, kept in the repository so every attempt is remembered. */
export function readLog(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
