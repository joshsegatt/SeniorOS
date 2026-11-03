// Grok CLI backend: one headless `grok -p` per run, inside the run's repository.
//
// Each run gets its own Grok home (GROK_HOME) and an empty profile folder (USERPROFILE/HOME): Grok also reads the
// user's ~/.claude, ~/.cursor and ~/.agents folders for compatibility, so pointing only GROK_HOME elsewhere would let
// the user's own skills and instructions in. GROK_MEMORY=0 keeps memory out.
//
// Login: the run's home holds a copy of the user's ~/.grok/auth.json WITHOUT its refresh token. A run uses the access
// token as it is (it lasts hours) and cannot refresh it, so it never rotates the user's own login. When the access
// token has expired, every run fails with an auth error: run `grok login` again.
//
// Arms: a pack is copied into the run's `plugins/` folder (auto-trusted there) and enabled in config.toml, so its
// skills and its PreToolUse/Stop hooks load as they would for a user. Grok's SessionStart hooks cannot add context
// (only a `systemMessage` is read), so the context a pack's session-start hook would inject is written to the run's
// global AGENTS.md instead, the same way for every pack.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';
import { BENCH_HOME, REPO_ROOT, SUPERPOWERS_DIR } from './util.mjs';

const GROK = process.env.SENIOROS_BENCH_GROK ?? join(homedir(), '.grok', 'bin', process.platform === 'win32' ? 'grok.exe' : 'grok');
const RM = { recursive: true, force: true, maxRetries: 10, retryDelay: 250 };

/** What each arm installs: a plugin folder to copy and how to get the context its session start injects. */
export const GROK_ARMS = {
  none: null,
  senioros: {
    name: 'senioros',
    copy: (dest) => {
      for (const part of ['.claude-plugin', 'hooks', 'adapters', 'skills', 'rules']) cpSync(join(REPO_ROOT, part), join(dest, part), { recursive: true });
    },
    context: (pluginDir, repo) => hookContext(process.execPath, [join(pluginDir, 'adapters', 'claude-code', 'hooks', 'session-start.mjs')], { cwd: repo }, pluginDir),
  },
  superpowers: {
    name: 'superpowers',
    copy: (dest) => {
      const git = join(SUPERPOWERS_DIR, '.git');
      cpSync(SUPERPOWERS_DIR, dest, { recursive: true, filter: (src) => src !== git && !src.startsWith(git + sep) });
    },
    context: (pluginDir, repo) => hookContext('bash', [join(pluginDir, 'hooks', 'session-start')], { cwd: repo }, pluginDir),
  },
};

/**
 * Runs a pack's session-start hook the way a host would and returns the context it adds.
 * @param {string} cmd
 * @param {string[]} args
 * @param {Record<string, unknown>} input
 * @param {string} pluginDir
 */
function hookContext(cmd, args, input, pluginDir) {
  const r = spawnSync(cmd, args, {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', ...input }),
    encoding: 'utf8', timeout: 30_000, windowsHide: true,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginDir },
  });
  if (r.status !== 0) throw new Error(`session-start hook failed (${cmd} ${args.join(' ')}): ${(r.stderr || r.stdout || '').slice(0, 300)}`);
  const out = JSON.parse(r.stdout);
  const ctx = out.hookSpecificOutput?.additionalContext ?? out.additional_context ?? out.additionalContext;
  if (typeof ctx !== 'string' || !ctx.trim()) throw new Error(`session-start hook gave no context: ${r.stdout.slice(0, 300)}`);
  return ctx;
}

/** The user's login without its refresh token, so runs cannot rotate it. */
export function accessOnlyAuth(text = readFileSync(join(homedir(), '.grok', 'auth.json'), 'utf8')) {
  // Every refresh token at any depth, whatever its spelling, so no future file shape lets a run rotate the login.
  const strip = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      if (/^refresh[_-]?token$/i.test(key)) delete value[key];
      else strip(value[key]);
    }
  };
  const auth = JSON.parse(text);
  strip(auth);
  return JSON.stringify(auth);
}

/**
 * A fresh Grok home and profile folder for one run, with the arm installed.
 * @param {string} arm
 * @param {string} repo
 * @param {string} [authText] the login file's text (default: the user's ~/.grok/auth.json)
 */
export function grokHome(arm, repo, authText) {
  if (!(arm in GROK_ARMS)) throw new Error(`Arm "${arm}" is not available for the grok backend (use ${Object.keys(GROK_ARMS).join(', ')}).`);
  mkdirSync(BENCH_HOME, { recursive: true });
  const root = mkdtempSync(join(BENCH_HOME, 'grok-home-'));
  const home = join(root, 'grok');
  const profile = join(root, 'profile');
  mkdirSync(home, { recursive: true });
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(home, 'auth.json'), accessOnlyAuth(authText));
  const spec = GROK_ARMS[arm];
  let config = '';
  if (spec) {
    const pluginDir = join(home, 'plugins', spec.name);
    spec.copy(pluginDir);
    config += `[plugins]\nenabled = ["${spec.name}"]\n`;
    writeFileSync(join(home, 'AGENTS.md'), spec.context(pluginDir, repo));
  }
  writeFileSync(join(home, 'config.toml'), config);
  const env = {
    ...process.env,
    GROK_HOME: home, USERPROFILE: profile, HOME: profile,
    GROK_MEMORY: '0', GROK_DISABLE_AUTOUPDATER: '1', GROK_TELEMETRY_ENABLED: '0',
  };
  delete env.XAI_API_KEY;
  return { root, env };
}

/**
 * Summarises a streaming-json transcript: tool calls, skills read, the final report and the cost.
 * @param {string} text
 */
export function summarizeGrokStream(text) {
  let actions = 0;
  const skills = new Set();
  let end = null;
  let report = '';
  for (const line of text.split('\n')) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'tool_call') {
      actions += 1;
      report = '';
      const input = JSON.stringify(event.rawInput ?? {});
      for (const m of input.matchAll(/skills[\\/]+([\w-]+)[\\/]+SKILL\.md/g)) skills.add(m[1]);
      if (event.rawInput?.skill) skills.add(String(event.rawInput.skill).replace(/^[\w-]+:/, ''));
    }
    if (event.type === 'text' && typeof event.data === 'string') report += event.data;
    if (event.type === 'end') end = event;
  }
  return {
    actions,
    skillsLoaded: [...skills],
    finalReport: report ? report.slice(0, 4000) : null,
    costUsd: end?.total_cost_usd ?? end?.total_cost ?? null,
    turns: end?.num_turns ?? null,
    resultSubtype: end?.stopReason ?? null,
    conversationId: end?.sessionId ?? null,
  };
}

/**
 * Runs one conversation with Grok and waits for it to end.
 * @param {{ prompt: string, repo: string, runDir: string, arm: string, model: string, timeoutMs: number }} job
 */
export function runGrok({ prompt, repo, runDir, arm, model, timeoutMs }) {
  return new Promise((resolve) => {
    let setup;
    try {
      setup = grokHome(arm, repo);
    } catch (e) {
      resolve({ timedOut: false, exitCode: null, error: `could not prepare grok: ${/** @type {Error} */ (e).message}` });
      return;
    }
    // Always-approve, as Grok documents for scripts. Not dontAsk: it refuses every compound shell command (`a; b`) and
    // a refusal ends the whole run. Under always-approve the SeniorOS guard denies instead of asking.
    const args = ['-p', prompt, '-m', model, '--always-approve', '--output-format', 'streaming-json'];
    const child = spawn(GROK, args, { cwd: repo, env: setup.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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
      void rm(setup.root, RM).catch(() => {});
      const summary = summarizeGrokStream(out);
      const authError = /unauthori[sz]ed|401|not logged in|log in|authentication/i.test(err) && !summary.resultSubtype;
      const error = spawnError
        ? `could not run grok: ${spawnError.message}`
        : authError
          ? `grok auth error (run \`grok login\` again): ${err.trim().slice(0, 300)}`
          : !timedOut && !summary.resultSubtype ? `grok exited ${exitCode} without a result: ${err.trim().slice(0, 300)}` : undefined;
      resolve({ timedOut, exitCode, ...summary, ...(error ? { error } : {}) });
    };
    child.on('error', (e) => finish(null, e));
    child.on('close', (code) => finish(code));
  });
}

export const grokAvailable = () => existsSync(GROK);
