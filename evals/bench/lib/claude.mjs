// Claude Code backend: one headless `claude -p` per run, inside the run's repository.
//
// Arms are command-line flags, not global config, so runs of different arms can overlap. Every arm loads only
// project settings (`--setting-sources project`) and no MCP servers, which keeps the user's own skills, plugins,
// hooks and MCP servers out. The user's global CLAUDE.md is still read (Claude Code has no switch that drops it
// while keeping `--plugin-dir`); it is the same text for every arm.
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
    const child = spawn(process.env.SENIOROS_BENCH_CLAUDE ?? 'claude', args, { cwd: repo, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
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
