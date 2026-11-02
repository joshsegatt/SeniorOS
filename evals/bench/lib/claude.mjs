// Claude Code backend: one headless `claude -p` per run, inside the run's repository.
//
// Arms are command-line flags, not global config, so runs of different arms can overlap. Every arm loads only
// project settings (`--setting-sources project`) and no MCP servers, which keeps the user's own skills, plugins,
// hooks and MCP servers out. Each run also gets its own empty config folder (CLAUDE_CONFIG_DIR), removed when the run
// ends, so the user's settings, history and memory stay out too, and parallel runs do not share state.
//
// That is not enough for the user's global CLAUDE.md: Claude Code finds ~/.claude/CLAUDE.md through the operating
// system's profile folder, whatever CLAUDE_CONFIG_DIR, HOME or USERPROFILE say (measured on Windows). An instruction
// there ("ask before changing payments") stops headless runs no one can answer, so `run` first asks one run whether
// user instructions reached it (`checkIsolation`) and refuses to start if they did: the run quotes one of the file's
// headings, or does not answer no. Move the file aside for the
// bench (and put it back after) to pass the check.
//
// The login is NOT copied into the folder: a subscription login rotates its refresh token on use, so a copy that
// refreshes leaves the user's own login expired. Isolated runs authenticate with CLAUDE_CODE_OAUTH_TOKEN (from
// `claude setup-token`) or ANTHROPIC_API_KEY instead. SENIOROS_BENCH_USER_CONFIG=1 keeps the user's own folder and
// skips the check, as runs before November 2026 did.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { BENCH_HOME, REPO_ROOT, SUPERPOWERS_DIR } from './util.mjs';

/**
 * The SeniorOS plugin without its hooks (no session-start rules, guard or finish gate), to measure what the hooks add.
 * Built once per bench home from the repository's manifest and skills.
 */
function skillsOnlyPlugin() {
  const dir = join(BENCH_HOME, 'plugins', 'senioros-skills');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(join(REPO_ROOT, '.claude-plugin'), join(dir, '.claude-plugin'), { recursive: true });
  cpSync(join(REPO_ROOT, 'skills'), join(dir, 'skills'), { recursive: true });
  return dir;
}

/** Extra `claude` arguments per arm (functions are resolved when a run starts). */
export const CLAUDE_ARMS = {
  none: [],
  superpowers: ['--plugin-dir', SUPERPOWERS_DIR],
  senioros: ['--plugin-dir', REPO_ROOT],
  'senioros-skills': () => ['--plugin-dir', skillsOnlyDir ??= skillsOnlyPlugin()],
};
let skillsOnlyDir;

const TOOLS = 'Bash Read Edit Write Glob Grep Skill';

/**
 * The environment of an isolated run: its own config folder and the token from the environment. The user's own
 * environment when `config` is null (SENIOROS_BENCH_USER_CONFIG=1). The home folder is left alone: changing it did not
 * keep CLAUDE.md out and would change how npm, git and Python behave inside the task.
 * @param {string | null} config
 */
export function isolatedEnv(config) {
  return config ? { ...process.env, CLAUDE_CONFIG_DIR: config } : process.env;
}

const CONFIG_PREFIX = 'claude-config-';
// A folder this old was left by an interrupted bench (Ctrl+C, a crash): no run lasts this long.
const STALE_MS = 12 * 60 * 60 * 1000;
/** Config folders of this process that still exist. */
const liveConfigs = new Set();
let swept = false;

/**
 * A new, empty config folder for one run: no settings, hooks, plugins, history, memory or login. One per run, because
 * Claude Code writes its state there and runs in parallel that shared one folder could overwrite each other's. Removed
 * with `releaseConfigDir` when the run ends, and at exit as a fallback. Null when the user's folder should be used.
 */
export function freshConfigDir() {
  if (process.env.SENIOROS_BENCH_USER_CONFIG === '1') return null;
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Isolated Claude runs need CLAUDE_CODE_OAUTH_TOKEN (create one with `claude setup-token`) or ANTHROPIC_API_KEY. '
        + 'The bench never copies your login file. To use your own config folder and its CLAUDE.md instead, set SENIOROS_BENCH_USER_CONFIG=1.',
    );
  }
  mkdirSync(BENCH_HOME, { recursive: true });
  if (!swept) {
    swept = true;
    sweepStaleConfigs();
    process.on('exit', () => { for (const dir of liveConfigs) removeDir(dir, 4); });
  }
  const dir = mkdtempSync(join(BENCH_HOME, CONFIG_PREFIX));
  liveConfigs.add(dir);
  return dir;
}

/** Removes a run's config folder once its `claude` process has exited. */
export function releaseConfigDir(dir) {
  if (dir && removeDir(dir)) liveConfigs.delete(dir);
}

/** Deletes config folders that interrupted benches left behind. Folders of a bench still running are recent. */
function sweepStaleConfigs() {
  for (const name of readdirSync(BENCH_HOME)) {
    if (!name.startsWith(CONFIG_PREFIX)) continue;
    const dir = join(BENCH_HOME, name);
    try {
      if (Date.now() - statSync(dir).mtimeMs > STALE_MS) removeDir(dir, 1);
    } catch {
      // Gone already, or not ours to read.
    }
  }
}

/**
 * Deletes a folder, retrying while Windows still holds its files: a process that just exited can keep them open for a
 * moment (EBUSY, EPERM), and Node's own retries are not enough there. Returns whether the folder is gone.
 * @param {string} dir
 * @param {number} [attempts]
 */
export function removeDir(dir, attempts = 20) {
  for (let i = 1; ; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return true;
    } catch (err) {
      const busy = ['EBUSY', 'EPERM', 'ENOTEMPTY', 'EACCES'].includes(/** @type {any} */ (err)?.code);
      if (!busy || i >= attempts) return false;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
}

/**
 * Summarises a stream-json transcript: tool calls, skills invoked, the final report and the cost.
 * @param {string} text newline-delimited JSON from `claude -p --output-format stream-json --verbose`
 */
export function summarizeStream(text) {
  let actions = 0;
  const skills = new Set();
  let result = null;
  for (const line of text.split('\n')) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'assistant') {
      for (const block of event.message?.content ?? []) {
        if (block.type !== 'tool_use') continue;
        actions += 1;
        if (block.name === 'Skill' && block.input?.skill) skills.add(String(block.input.skill).replace(/^[\w-]+:/, ''));
      }
    }
    if (event.type === 'result') result = event;
  }
  return {
    actions,
    skillsLoaded: [...skills],
    finalReport: typeof result?.result === 'string' ? result.result.slice(0, 4000) : null,
    costUsd: result?.total_cost_usd ?? null,
    turns: result?.num_turns ?? null,
    resultSubtype: result?.subtype ?? null,
    conversationId: result?.session_id ?? null,
    // A usage limit or API error ends the run before the agent works; it must not be graded as the agent's result.
    apiError: result?.is_error ? `${result.api_error ?? result.terminal_reason ?? 'error'}${result.api_error_status ? ` (${result.api_error_status})` : ''}` : null,
  };
}

/**
 * Runs one conversation with Claude Code and waits for it to end.
 * @param {{ prompt: string, repo: string, runDir: string, arm: string, model: string, timeoutMs: number }} job
 */
export function runClaude({ prompt, repo, runDir, arm, model, timeoutMs }) {
  const spec = CLAUDE_ARMS[arm];
  const armArgs = typeof spec === 'function' ? spec() : spec;
  if (!armArgs) throw new Error(`Arm "${arm}" is not available for the claude backend (use ${Object.keys(CLAUDE_ARMS).join(', ')}).`);
  const args = [
    '-p', '--model', model, '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence',
    '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', TOOLS,
    ...armArgs,
  ];
  return new Promise((resolve) => {
    const config = freshConfigDir();
    const child = spawn(process.env.SENIOROS_BENCH_CLAUDE ?? 'claude', args, { cwd: repo, env: isolatedEnv(config), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    // The prompt goes through stdin: `--allowedTools` takes several values and would swallow a trailing argument.
    child.stdin.end(prompt);
    let out = '';
    let err = '';
    let timedOut = false;
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    let finished = false;
    const finish = (exitCode, spawnError) => {
      // A spawn error can be followed by `close`; the run ends once.
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      releaseConfigDir(config);
      writeFileSync(join(runDir, 'transcript.jsonl'), out);
      const summary = summarizeStream(out);
      const error = spawnError
        ? `could not run claude: ${spawnError.message}`
        : summary.apiError
          ? `claude API error: ${summary.apiError}`
          : !timedOut && !summary.resultSubtype ? `claude exited ${exitCode} without a result: ${err.trim().slice(0, 300)}` : undefined;
      resolve({ timedOut, exitCode, ...summary, ...(error ? { error } : {}) });
    };
    child.on('error', (e) => finish(null, e));
    child.on('close', (code) => finish(code));
  });
}

/**
 * The headings of the user's global CLAUDE.md, the text a leaking run would quote. Claude Code reads it from the
 * operating system's profile folder, which can differ from HOME/USERPROFILE, so both are looked at.
 * @param {string[]} [files]
 */
export function userInstructionHeadings(files = [...new Set([homedir(), userInfo().homedir].map((h) => join(h, '.claude', 'CLAUDE.md')))]) {
  const headings = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
      const text = plain(m[1]);
      if (text.length >= 4) headings.push(text);
    }
  }
  return headings;
}

const plain = (text) => text.toLowerCase().replace(/[`*_#"']/g, '').replace(/\s+/g, ' ').trim();

/**
 * Whether the check run's answer shows that user instructions reached it. Quoting one of the user's own headings is
 * proof of a leak, whatever else the answer says. Otherwise the answer must say no: "NONE", "None." or "No, …" (a
 * model rarely replies with the bare word it was asked for). Anything else is not clean, since it cannot be told
 * apart from a run that read the instructions and answered in its own words.
 * @param {string} answer
 * @param {string[]} headings from `userInstructionHeadings`
 * @returns {{ clean: boolean, why?: string }}
 */
export function isolationVerdict(answer, headings) {
  const text = plain(answer);
  const quoted = headings.find((h) => text.includes(h));
  if (quoted) return { clean: false, why: `it quoted a heading of your CLAUDE.md ("${quoted}")` };
  if (/^\W*(none|no)\b/i.test(answer)) return { clean: true };
  return { clean: false, why: 'it did not answer NONE' };
}

/**
 * Asks one isolated run whether any user-level instructions reached it. A run that sees the user's CLAUDE.md means
 * the isolation leaks and the bench must not start.
 * @param {string} model
 */
export function checkIsolation(model) {
  const prompt = 'Do you have user-level instructions in your context, such as a CLAUDE.md from the user\'s home folder? '
    + 'If yes, reply with the first heading of those instructions. If not, reply with exactly NONE.';
  const config = freshConfigDir();
  let r;
  try {
    r = spawnSync(process.env.SENIOROS_BENCH_CLAUDE ?? 'claude', ['-p', '--model', model, '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence'], {
      input: prompt, env: isolatedEnv(config), encoding: 'utf8', timeout: 180_000, windowsHide: true, cwd: BENCH_HOME,
    });
  } finally {
    releaseConfigDir(config);
  }
  const answer = `${r.stdout ?? ''}`.trim() || `${r.stderr ?? ''}`.trim() || String(r.error?.message ?? '');
  const verdict = r.status === 0 ? isolationVerdict(answer, userInstructionHeadings()) : { clean: false, why: `claude exited ${r.status ?? 'without a status'}` };
  return { answer: answer.slice(0, 300), ...verdict };
}
