// Claude Code backend: one headless `claude -p` per run, inside the run's repository.
//
// Arms are command-line flags, not global config, so runs of different arms can overlap. Every arm loads only
// project settings (`--setting-sources project`) and no MCP servers, which keeps the user's own skills, plugins,
// hooks and MCP servers out. Each run also gets an empty throwaway config folder (CLAUDE_CONFIG_DIR), removed when the
// bench exits, so the user's settings, history and memory stay out too.
//
// That is not enough for the user's global CLAUDE.md: Claude Code finds ~/.claude/CLAUDE.md through the operating
// system's profile folder, whatever CLAUDE_CONFIG_DIR, HOME or USERPROFILE say (measured on Windows). An instruction
// there ("ask before changing payments") stops headless runs no one can answer, so `run` first asks one run whether
// user instructions reached it (`checkIsolation`) and refuses to start if they did. Move the file aside for the
// bench (and put it back after) to pass the check.
//
// The login is NOT copied into the folder: a subscription login rotates its refresh token on use, so a copy that
// refreshes leaves the user's own login expired. Isolated runs authenticate with CLAUDE_CODE_OAUTH_TOKEN (from
// `claude setup-token`) or ANTHROPIC_API_KEY instead. SENIOROS_BENCH_USER_CONFIG=1 keeps the user's own folder and
// skips the check, as runs before November 2026 did.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
 * The environment of an isolated run: an empty config folder and the token from the environment. The user's own
 * environment when SENIOROS_BENCH_USER_CONFIG=1. The home folder is left alone: changing it did not keep CLAUDE.md out
 * and would change how npm, git and Python behave inside the task.
 */
export function isolatedEnv() {
  const config = isolatedConfigDir();
  return config ? { ...process.env, CLAUDE_CONFIG_DIR: config } : process.env;
}

let isolatedConfig;
/**
 * An empty config folder: no settings, hooks, plugins, history, memory or login. Created once per bench process and
 * removed when it exits. Null when the user's folder should be used.
 */
export function isolatedConfigDir() {
  if (process.env.SENIOROS_BENCH_USER_CONFIG === '1') return null;
  if (isolatedConfig !== undefined) return isolatedConfig;
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Isolated Claude runs need CLAUDE_CODE_OAUTH_TOKEN (create one with `claude setup-token`) or ANTHROPIC_API_KEY. '
        + 'The bench never copies your login file. To use your own config folder and its CLAUDE.md instead, set SENIOROS_BENCH_USER_CONFIG=1.',
    );
  }
  mkdirSync(BENCH_HOME, { recursive: true });
  const dir = mkdtempSync(join(BENCH_HOME, 'claude-config-'));
  // Removed on a normal exit; a folder left by Ctrl+C is empty of anything personal and can be deleted.
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  isolatedConfig = dir;
  return dir;
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
    const env = isolatedEnv();
    const child = spawn(process.env.SENIOROS_BENCH_CLAUDE ?? 'claude', args, { cwd: repo, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
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
    const finish = (exitCode, spawnError) => {
      clearTimeout(timer);
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
 * Asks one isolated run whether any user-level instructions reached it. Returns the run's answer and whether it is
 * clean ("NONE"). A run that quotes the user's CLAUDE.md means the isolation leaks and the bench must not start.
 * @param {string} model
 */
export function checkIsolation(model) {
  const prompt = 'Do you have user-level instructions in your context, such as a CLAUDE.md from the user\'s home folder? '
    + 'If yes, reply with the first heading of those instructions. If not, reply with exactly NONE.';
  const r = spawnSync(process.env.SENIOROS_BENCH_CLAUDE ?? 'claude', ['-p', '--model', model, '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence'], {
    input: prompt, env: isolatedEnv(), encoding: 'utf8', timeout: 180_000, windowsHide: true, cwd: BENCH_HOME,
  });
  const answer = `${r.stdout ?? ''}`.trim() || `${r.stderr ?? ''}`.trim() || String(r.error?.message ?? '');
  return { answer: answer.slice(0, 300), clean: r.status === 0 && /^\W*NONE\W*$/i.test(answer) };
}
