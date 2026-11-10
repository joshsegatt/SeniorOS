// Codex CLI backend: one headless `codex exec` per run, inside the run's repository.
//
// Login: the bench has its own Codex home (BENCH_HOME/codex-home) with its own login, made once with `codex login`
// (CODEX_HOME set to that folder). The user's ~/.codex is never read: Codex refuses a copy of its login without the
// refresh token, and a full copy would let a run rotate the user's own login.
//
// Arms: the SeniorOS plugin is installed once in that home, from this checkout, as the README installs it. A `none`
// run turns plugins off (`--disable plugins`); every run shares the home, as parallel Codex sessions do.
//
// Not isolated by Codex itself: it reads the user's ~/.agents/skills whatever HOME says, and a long list there pushes
// a plugin's skills out of the model's context. `prepareCodex` stops the bench while that folder has skills.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BENCH_HOME, REPO_ROOT } from './util.mjs';

const CODEX = process.env.SENIOROS_BENCH_CODEX ?? 'codex';
// npm installs `codex` as a .cmd on Windows, which only a shell can start. Every argument is a fixed word, a checked
// model name or a quoted path of this checkout, and the prompt goes through stdin: nothing a task writes reaches the shell.
const SHELL = process.platform === 'win32';
/** The program and its arguments for spawn: one command line under a shell, since Node does not quote there. */
const command = (args) => (SHELL ? [`${CODEX} ${args.join(' ')}`, []] : [CODEX, args]);
export const CODEX_HOME = join(BENCH_HOME, 'codex-home');

/** Extra `codex exec` arguments per arm. */
export const CODEX_ARMS = {
  none: ['--disable', 'plugins'],
  senioros: [],
};

function codexEnv() {
  const env = { ...process.env, CODEX_HOME };
  // The bench home's own login is used, never a key from the user's shell.
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  return env;
}

function codex(args) {
  const r = spawnSync(...command(args), { env: codexEnv(), shell: SHELL, encoding: 'utf8', timeout: 120_000, windowsHide: true });
  return { code: r.status, text: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}` };
}

/**
 * Checks the bench can measure anything before a run is spent: a model name, no user skills reaching the runs, a login
 * in the bench home, and the plugin installed fresh from this checkout.
 * @param {string[]} arms
 * @param {string} model
 * @param {string} [userSkills] the folder Codex reads the user's skills from
 */
export function prepareCodex(arms, model, userSkills = join(homedir(), '.agents', 'skills')) {
  if (!/^[\w.-]+$/.test(model)) throw new Error(`The codex backend needs --model <name> (list them with \`codex debug models\`); got "${model}".`);
  if (process.env.SENIOROS_BENCH_USER_CONFIG !== '1' && existsSync(userSkills) && readdirSync(userSkills).length > 0) {
    throw new Error(`Codex would load your own skills in every run (${userSkills}). Move that folder aside for the bench, or set SENIOROS_BENCH_USER_CONFIG=1 to measure with it.`);
  }
  mkdirSync(CODEX_HOME, { recursive: true });
  if (!/^Logged in/m.test(codex(['login', 'status']).text)) {
    throw new Error(`The bench has its own Codex login and it is missing. Log in once with CODEX_HOME set to ${CODEX_HOME}: \`codex login\`.`);
  }
  if (!arms.includes('senioros')) return;
  // The cache is keyed by version, so an edited checkout at the same version would otherwise run stale code.
  rmSync(join(CODEX_HOME, 'plugins', 'cache', 'senioros'), { recursive: true, force: true });
  for (const args of [['plugin', 'marketplace', 'add', SHELL ? `"${REPO_ROOT}"` : REPO_ROOT], ['plugin', 'add', 'senioros@senioros']]) {
    const r = codex(args);
    if (r.code !== 0) throw new Error(`codex ${args.join(' ')} failed: ${r.text.trim().slice(0, 300)}`);
  }
}

/**
 * Summarises a `codex exec --json` transcript: tool calls, skills read, the final report and how the turn ended.
 * @param {string} text
 */
export function summarizeCodexStream(text) {
  let actions = 0;
  const skills = new Set();
  let report = null;
  let conversationId = null;
  let resultSubtype = null;
  let apiError = null;
  for (const line of text.split('\n')) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'thread.started') conversationId = event.thread_id ?? null;
    if (event.type === 'turn.completed') resultSubtype = 'completed';
    if (event.type === 'turn.failed') apiError = String(event.error?.message ?? 'turn failed');
    if (event.type !== 'item.completed' || !event.item) continue;
    const { type } = event.item;
    if (type === 'agent_message') report = String(event.item.text ?? '');
    else if (type !== 'reasoning' && type !== 'todo_list' && type !== 'error') {
      actions += 1;
      for (const m of JSON.stringify(event.item).matchAll(/skills[\\/]+([\w-]+)[\\/]+SKILL\.md/g)) skills.add(m[1]);
    }
  }
  return {
    actions,
    skillsLoaded: [...skills],
    finalReport: report ? report.slice(0, 4000) : null,
    costUsd: null,
    turns: null,
    resultSubtype,
    conversationId,
    apiError,
  };
}

/**
 * Runs one conversation with Codex and waits for it to end.
 * @param {{ prompt: string, repo: string, runDir: string, arm: string, model: string, timeoutMs: number }} job
 */
export function runCodex({ prompt, repo, runDir, arm, model, timeoutMs }) {
  if (!Object.hasOwn(CODEX_ARMS, arm)) throw new Error(`Arm "${arm}" is not available for the codex backend (use ${Object.keys(CODEX_ARMS).join(', ')}).`);
  // The sandbox stays on (writes only inside the repository). Hook trust is skipped because nobody is there to open
  // `/hooks`: the only hooks in the bench home are the plugin's, installed from this checkout.
  // On Windows a new Codex home has no sandbox chosen and every command is refused ("blocked by policy"), so the
  // bench names the one Codex sets up on first use there.
  const sandbox = ['-s', 'workspace-write', ...(process.platform === 'win32' ? ['-c', 'windows.sandbox=elevated'] : [])];
  const args = ['exec', '--json', '--ephemeral', ...sandbox, '--dangerously-bypass-hook-trust', '-m', model, ...CODEX_ARMS[arm]];
  return new Promise((resolve) => {
    const child = spawn(...command(args), { cwd: repo, env: codexEnv(), shell: SHELL, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    // A run that could not start closes stdin first; the `error` or `close` below reports it.
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
    let out = '';
    let err = '';
    let timedOut = false;
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill();
    }, timeoutMs);
    let finished = false;
    const finish = (exitCode, spawnError) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      writeFileSync(join(runDir, 'transcript.jsonl'), out);
      if (err) writeFileSync(join(runDir, 'stderr.txt'), err);
      const summary = summarizeCodexStream(out);
      const error = spawnError
        ? `could not run codex: ${spawnError.message}`
        : summary.apiError
          ? `codex error${/401|Unauthorized/.test(summary.apiError) ? ` (log in again with CODEX_HOME=${CODEX_HOME})` : ''}: ${summary.apiError.slice(0, 300)}`
          : !timedOut && !summary.resultSubtype ? `codex exited ${exitCode} without a result: ${err.trim().slice(0, 300)}` : undefined;
      resolve({ timedOut, exitCode, ...summary, ...(error ? { error } : {}) });
    };
    child.on('error', (e) => finish(null, e));
    child.on('close', (code) => finish(code));
  });
}
