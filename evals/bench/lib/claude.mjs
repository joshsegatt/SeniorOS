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
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { BENCH_HOME, REPO_ROOT, SUPERPOWERS_DIR, newestMtime } from './util.mjs';

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
// A folder untouched this long was left by an interrupted bench (Ctrl+C, a crash): no run lasts this long.
export const STALE_MS = 12 * 60 * 60 * 1000;
/** Config folders of this process that still exist. */
const liveConfigs = new Set();
let started = false;
// Node retries EBUSY, EPERM and ENOTEMPTY, which Windows returns while a process that just exited still holds files.
const RM = { recursive: true, force: true, maxRetries: 10, retryDelay: 250 };

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
  if (!started) {
    started = true;
    sweepStaleConfigs();
    process.on('exit', () => {
      for (const dir of liveConfigs) {
        try {
          rmSync(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
        } catch {
          // Still held: the next bench sweeps it once it is stale.
        }
      }
    });
  }
  const dir = mkdtempSync(join(BENCH_HOME, CONFIG_PREFIX));
  liveConfigs.add(dir);
  return dir;
}

/**
 * Removes a run's config folder once its `claude` process has exited, without blocking the runs still going.
 * @param {string | null} dir
 */
export async function releaseConfigDir(dir) {
  if (!dir) return;
  try {
    await rm(dir, RM);
    liveConfigs.delete(dir);
  } catch {
    // Still held after the retries: the exit handler tries again.
  }
}

/**
 * Deletes config folders that interrupted benches left behind. A folder counts as stale when nothing in it changed for
 * `STALE_MS`, so a long run of another bench, which keeps writing into it, is kept.
 * @param {number} [now]
 */
export function sweepStaleConfigs(now = Date.now()) {
  for (const name of readdirSync(BENCH_HOME)) {
    if (!name.startsWith(CONFIG_PREFIX)) continue;
    const dir = join(BENCH_HOME, name);
    try {
      if (liveConfigs.has(dir)) continue;
      const touched = Math.max(statSync(dir).mtimeMs, newestMtime(dir));
      if (now - touched > STALE_MS) rmSync(dir, { recursive: true, force: true });
    } catch {
      // Gone already, held, or not ours to read.
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
    let child;
    try {
      child = spawn(process.env.SENIOROS_BENCH_CLAUDE ?? 'claude', args, { cwd: repo, env: isolatedEnv(config), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      // Some invalid commands throw here instead of emitting `error`.
      void releaseConfigDir(config);
      resolve({ timedOut: false, exitCode: null, error: `could not run claude: ${/** @type {Error} */ (e).message}` });
      return;
    }
    // The prompt goes through stdin: `--allowedTools` takes several values and would swallow a trailing argument.
    child.stdin.end(prompt);
    let out = '';
    let err = '';
    let timedOut = false;
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      timedOut = true;
      stopTree(child);
    }, timeoutMs);
    let finished = false;
    const finish = (exitCode, spawnError) => {
      // A spawn error can be followed by `close`; the run ends once.
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      void releaseConfigDir(config);
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
 * Stops a run and the processes it started. On Windows killing `claude` alone leaves its shells and test runs going,
 * still writing to the repository and holding the config folder.
 * @param {import('node:child_process').ChildProcess} child
 */
function stopTree(child) {
  if (process.platform !== 'win32' || !child.pid) {
    child.kill();
    return;
  }
  spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => child.kill());
}

/** The folders Claude Code may read the user's CLAUDE.md from: HOME/USERPROFILE and the operating system's profile. */
function profileHomes() {
  const homes = [homedir()];
  try {
    homes.push(userInfo().homedir);
  } catch {
    // No account entry (some containers): HOME is all there is.
  }
  return [...new Set(homes)];
}

/**
 * The headings of the user's global CLAUDE.md, the text a leaking run would quote. Claude Code reads it from the
 * operating system's profile folder, which can differ from HOME/USERPROFILE, so both are looked at.
 * @param {string[]} [files]
 */
export function userInstructionHeadings(files = profileHomes().map((h) => join(h, '.claude', 'CLAUDE.md'))) {
  const headings = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    // A `# comment` inside a code block is not a heading.
    const text = readFileSync(file, 'utf8').replace(/^\s*(```|~~~)[\s\S]*?^\s*\1/gm, '');
    for (const m of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
      const text = plain(m[1]);
      if (text.length >= 4) headings.push(text);
    }
  }
  return headings;
}

const plain = (text) => text.toLowerCase().replace(/[`*_#"']/g, '').replace(/\s+/g, ' ').trim();

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The parts of a heading a run could mention: the whole heading and each piece between brackets, dashes, slashes or
 * colons, when long enough not to be a common word ("google ads", "fgribreau", "projetos"; not "ui" or "mcp").
 * @param {string} heading
 */
function phrases(heading) {
  const parts = heading.split(/[()[\]{}–—\-/:,|]+/).map((p) => p.trim()).filter((p) => p.length >= 6);
  return [...new Set([heading, ...parts])];
}

/**
 * Whether the check run's answer shows that user instructions reached it. Quoting one of the user's own headings is
 * proof of a leak, whatever else the answer says, and so is naming a distinctive part of one. Otherwise the answer
 * must say no: "NONE", "None." or "No, …" (a model rarely replies with the bare word it was asked for). Anything else is not clean, since it cannot be told
 * apart from a run that read the instructions and answered in its own words.
 * @param {string} answer
 * @param {string[]} headings from `userInstructionHeadings`
 * @returns {{ clean: boolean, why?: string }}
 */
export function isolationVerdict(answer, headings) {
  const text = plain(answer);
  const quoted = headings.flatMap(phrases).find((p) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(p)}($|[^\\p{L}\\p{N}])`, 'u').test(text));
  if (quoted) return { clean: false, why: `it named a heading of your CLAUDE.md ("${quoted}")` };
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
    void releaseConfigDir(config);
  }
  const answer = `${r.stdout ?? ''}`.trim() || `${r.stderr ?? ''}`.trim() || String(r.error?.message ?? '');
  const verdict = r.status === 0 ? isolationVerdict(answer, userInstructionHeadings()) : { clean: false, why: `claude exited ${r.status ?? 'without a status'}` };
  return { answer: answer.slice(0, 300), ...verdict };
}
