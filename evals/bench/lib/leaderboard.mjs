// The public leaderboard: each submission is one bench run (or several merged), summarized per arm and task, with
// where every pack came from. `LEADERBOARD.md` is generated from the submissions and checked in, so the numbers on it
// can be traced to a file and rebuilt.
//
// A submission keeps counts, not transcripts: passes and runs per task, and the cost. That is enough to rebuild every
// figure on the board (Wilson interval, the exact test against the model alone, cost per passing run). A submission
// is marked verified only when someone other than its submitter re-ran it and got a result inside its interval.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { BENCH_SRC, REPO_ROOT } from './util.mjs';
import { formatP, stratifiedExact, wilson } from './stats.mjs';

export const LEADERBOARD_DIR = join(BENCH_SRC, 'leaderboard');
export const LEADERBOARD_MD = join(BENCH_SRC, 'LEADERBOARD.md');
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Graded runs of one or more results folders. */
function readResults(dirs) {
  return dirs.flatMap((dir) => readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'bench.json')
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .filter((r) => r.runId));
}

/** The manifest a run writes (`bench.json`), or null for results older than it. */
function readManifest(dir) {
  const file = join(dir, 'bench.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/**
 * Summarizes results folders into a submission.
 * @param {string[]} dirs
 * @param {{ id: string, title: string, model?: string, backend?: string, notes?: string, runBy?: string }} opts
 */
export function summarize(dirs, opts) {
  if (!ID.test(opts.id)) throw new Error(`Submission id "${opts.id}": use lowercase letters, digits and dashes.`);
  if (!opts.title) throw new Error('A submission needs --title.');
  // The same folder given twice would count every run twice and narrow every interval.
  dirs = [...new Set(dirs.map((d) => resolve(d)))];
  const manifests = dirs.map(readManifest);
  const all = readResults(dirs);
  // A run the host or the network ended (a usage limit, an API error) says nothing about the pack: it is left out
  // and counted, so the board can say how many were dropped.
  const broken = (r) => Boolean(r.outcome?.error || r.outcome?.apiError);
  const results = all.filter((r) => !broken(r));
  if (!results.length) throw new Error(`No graded runs in ${dirs.join(', ')}.`);
  const known = manifests.filter(Boolean);
  const model = opts.model ?? known[0]?.model;
  const backend = opts.backend ?? known[0]?.backend;
  if (!model || !backend) throw new Error('These results have no bench.json (they predate it): give --model and --backend.');
  for (const m of known) {
    if (m.model !== model || m.backend !== backend) throw new Error(`Results mix models or backends (${m.backend}/${m.model} against ${backend}/${model}).`);
  }
  const tasks = [...new Set(results.map((r) => r.taskId))].sort();
  const armNames = [...new Set(results.map((r) => r.arm))].sort();
  /** @type {Record<string, any>} */
  const arms = {};
  for (const name of armNames) {
    const rs = results.filter((r) => r.arm === name);
    const sources = known.map((m) => m.arms?.[name]).filter((p) => p !== undefined);
    if (new Set(sources.map((p) => JSON.stringify(p && { commit: p.commit, dirty: p.dirty }))).size > 1) {
      throw new Error(`Arm "${name}" ran different code across these folders (${sources.map((p) => p?.commit?.slice(0, 7) ?? 'none').join(', ')}): submit them separately.`);
    }
    const costs = rs.map((r) => r.outcome?.costUsd).filter((c) => typeof c === 'number');
    /** @type {Record<string, [number, number]>} */
    const byTask = {};
    for (const t of tasks) {
      const mine = rs.filter((r) => r.taskId === t);
      if (mine.length) byTask[t] = [mine.filter((r) => r.pass).length, mine.length];
    }
    const provenance = sources[0] ?? null;
    const dropped = all.filter((r) => r.arm === name && broken(r)).length;
    arms[name] = {
      provenance,
      byTask,
      runs: rs.length,
      ...(dropped ? { droppedRuns: dropped } : {}),
      passes: rs.filter((r) => r.pass).length,
      timeouts: rs.filter((r) => r.metrics?.timedOut).length,
      costUsd: round(costs.reduce((s, c) => s + c, 0)),
      costRuns: costs.length,
      maxCostUsd: costs.length ? round(Math.max(...costs)) : null,
    };
  }
  const trials = Math.max(...Object.values(arms).flatMap((a) => Object.values(a.byTask).map(([, n]) => n)));
  const dates = results.map((r) => r.gradedAt).filter(Boolean).sort();
  return {
    schema: 1,
    id: opts.id,
    title: opts.title,
    date: (dates.at(-1) ?? new Date().toISOString()).slice(0, 10),
    backend,
    model,
    trials,
    tasks,
    runBy: opts.runBy ?? 'SeniorOS maintainers',
    verified: false,
    ...(opts.notes ? { notes: opts.notes } : {}),
    arms,
  };
}

const round = (x) => Math.round(x * 10000) / 10000;

/** Every submission, newest first. */
export function loadSubmissions(dir = LEADERBOARD_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: join(dir, f), ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** Cost of one passing run, charging runs with no cost (timeouts) at the arm's top cost; null when nothing passed. */
export function armCostPerPass(arm) {
  if (!arm.passes || !arm.costRuns) return null;
  return (arm.costUsd + (arm.runs - arm.costRuns) * (arm.maxCostUsd ?? 0)) / arm.passes;
}

/** Exact p against the model alone, task by task on the tasks both ran; null without a `none` arm. */
export function armVsNone(arm, none) {
  if (!none || arm === none) return null;
  const tables = Object.entries(arm.byTask)
    .filter(([t]) => none.byTask[t])
    .map(([t, [k, n]]) => [k, n, none.byTask[t][0], none.byTask[t][1]]);
  return tables.length ? stratifiedExact(tables) : null;
}

const label = (name) => (name === 'none' ? 'model alone' : name);

function commitCell(p) {
  if (!p) return '-';
  if (!p.commit) return p.source ? `\`${p.source}\`` : 'not recorded';
  const short = `\`${p.commit.slice(0, 7)}\`${p.dirty ? ' (uncommitted changes)' : ''}`;
  const gh = /github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(p.url ?? '') ?? /^([\w.-]+\/[\w.-]+)@/.exec(p.source ?? '');
  return gh ? `[${short}](https://github.com/${gh[1]}/tree/${p.commit})` : short;
}

/** The markdown board for a list of submissions. */
export function renderLeaderboard(submissions) {
  const lines = [
    '<!-- Generated by `node evals/bench/bench.mjs leaderboard` from evals/bench/leaderboard/*.json. Do not edit by hand. -->',
    '# Skill pack leaderboard',
    '',
    'Each table is one bench run: the same model, the same tasks and the same deterministic grader, with no pack ',
    '("model alone") and with each pack loaded as its Claude Code plugin ships. Any plugin can be added; see ',
    '[SUBMITTING.md](SUBMITTING.md).',
    '',
    'How to read a table:',
    '',
    '- **Pass** counts passing runs, with the 95% Wilson interval. Overlapping intervals mean the run cannot tell the two apart.',
    '- **vs model alone** is the two-sided exact p against the model alone, task by task. **Separable** compares it with ',
    '  0.05 divided by the number of packs in the table (Bonferroni), so a table with more packs needs a smaller p.',
    '- **Cost per pass** is every run\'s cost over the passing runs; a timeout counts at the arm\'s most expensive run.',
    '- A table is **re-run** when someone other than its submitter ran it again and landed inside its interval.',
    '',
    'A table measures the task class it was built for, not skill packs in general: read the tasks before the ranking.',
    '',
    'The SeniorOS maintainers wrote this bench and ran the first tables, so read them as a claim to check, not a ',
    'verdict: the tasks were written by agents that never saw any pack, the grader is in this folder, and every table ',
    'can be re-run with the commands in [SUBMITTING.md](SUBMITTING.md).',
    '',
  ];
  if (!submissions.length) lines.push('No submissions yet.', '');
  for (const s of submissions) {
    const names = Object.keys(s.arms);
    const none = s.arms.none;
    const packs = names.filter((n) => n !== 'none');
    const alpha = 0.05 / Math.max(1, packs.length);
    const rows = names
      .map((n) => ({ n, a: s.arms[n], rate: s.arms[n].runs ? s.arms[n].passes / s.arms[n].runs : 0 }))
      .sort((x, y) => y.rate - x.rate || (armCostPerPass(x.a) ?? Infinity) - (armCostPerPass(y.a) ?? Infinity) || x.n.localeCompare(y.n));
    lines.push(`## ${s.title}`, '');
    lines.push(`${s.model} (${s.backend}), ${s.tasks.length} task${s.tasks.length === 1 ? '' : 's'} x ${s.trials} trials, ${s.date}. ` +
      `Tasks: ${s.tasks.map((t) => `\`${t}\``).join(', ')}. Run by ${s.runBy ?? 'not recorded'}; ${s.verified ? 're-run by someone else' : 'not yet re-run by anyone else'}. ` +
      `Source: [${s.id}.json](${relative(BENCH_SRC, s.file ?? join(LEADERBOARD_DIR, `${s.id}.json`)).split('\\').join('/')}).`, '');
    if (s.notes) lines.push(s.notes, '');
    lines.push('| Pack | Pass (95% interval) | vs model alone | Separable | Cost per pass | Pack commit |', '|---|---|---|---|---|---|');
    for (const { n, a } of rows) {
      const [lo, hi] = wilson(a.passes, a.runs);
      const p = armVsNone(a, none);
      const cpp = armCostPerPass(a);
      lines.push(`| ${n === 'none' ? '**model alone**' : `**${label(n)}**`} | ${a.passes}/${a.runs} (${Math.round(lo * 100)}–${Math.round(hi * 100)}%) | ` +
        `${p === null ? '-' : `p ${formatP(p)}`} | ${p === null ? '-' : p < alpha ? 'yes' : 'no'} | ${cpp === null ? '-' : `$${cpp.toFixed(2)}`} | ${commitCell(a.provenance)} |`);
    }
    const dropped = rows.filter(({ a }) => a.droppedRuns).map(({ n, a }) => `${a.droppedRuns} of ${label(n)}`);
    if (dropped.length) lines.push('', `Left out: runs the host or the network ended (a usage limit, an API error), ${dropped.join(', ')}.`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Writes LEADERBOARD.md; with `check`, only reports whether it is current. */
export function writeLeaderboard({ check = false } = {}) {
  const md = renderLeaderboard(loadSubmissions());
  // A Windows checkout may turn line endings into CRLF; that is not a stale board.
  const current = existsSync(LEADERBOARD_MD) ? readFileSync(LEADERBOARD_MD, 'utf8').replace(/\r\n/g, '\n') : '';
  if (check) return current === md;
  writeFileSync(LEADERBOARD_MD, md);
  return true;
}

export const leaderboardPath = () => relative(REPO_ROOT, LEADERBOARD_MD);
