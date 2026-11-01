import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync, type StdioOptions } from 'node:child_process';
import { exists, readJson } from './fs-utils.js';
import { ecosystemPlan, environmentFailure, noTestsCollected, type EcosystemCheck } from './ecosystems.js';
import { testsRan } from './test-counts.js';
import type { ProofCheck, ProofReport } from '../types.js';
import type { ProofCheckConfig } from './config.js';

interface PackageJson {
  scripts?: Record<string, string>;
}

const ORDER = ['typecheck', 'lint', 'test', 'build'] as const;
const NO_TESTS = 'no tests ran';
/** Checks whose output is read for the number of tests that ran. */
const isTestCheck = (name: string) => /\btests?\b/i.test(name);

function packageRunner(manager: string | null): string {
  if (manager === 'pnpm') return 'pnpm';
  if (manager === 'yarn') return 'yarn';
  if (manager === 'bun') return 'bun';
  return 'npm';
}

function argsFor(manager: string, script: string): string[] {
  if (manager === 'yarn') return [script];
  if (manager === 'bun') return ['run', script];
  return ['run', script];
}

export interface ProofOptions {
  /**
   * Where child script output goes. `stderr` keeps stdout clean for machine-readable output (`--json`).
   * Defaults to `inherit`.
   */
  childOutput?: 'inherit' | 'stderr';
  /** Checks from `.senior/config.json`; when present they replace the package-script baseline. */
  checks?: ProofCheckConfig[];
  /**
   * Absolute paths of the changed files. Python, Go and Rust projects that own none of them are skipped; null or
   * omitted runs every project.
   */
  changed?: string[] | null;
  /**
   * Whether the working tree has uncommitted changes, when the caller already knows it (index.ts scans once); otherwise
   * provenance runs its own scan. Changes under .senior/ do not count.
   */
  dirty?: boolean | null;
}

interface PlannedCheck {
  name: string;
  /** Display command; null when the check is unavailable. */
  command: string | null;
  skipReason?: string;
  file?: string;
  args?: string[];
  shell?: boolean;
  cwd?: string;
  python?: EcosystemCheck['python'];
  pythonTool?: true;
}

function packageScriptPlan(pkg: PackageJson | null, packageManager: string | null): PlannedCheck[] {
  const scripts = pkg?.scripts ?? {};
  const manager = packageRunner(packageManager);
  return ORDER.map((name) => {
    if (!scripts[name]) {
      return { name, command: null, skipReason: pkg ? `no "${name}" script in package.json` : 'no package.json' };
    }
    const args = argsFor(manager, name);
    const command = `${manager} ${args.join(' ')}`;
    // Windows needs a shell to resolve npm.cmd/pnpm.cmd. Pass one command string (built only from fixed
    // tokens) instead of args + shell, which Node 24 deprecates (DEP0190).
    return process.platform === 'win32'
      ? { name, command, file: command, shell: true }
      : { name, command, file: manager, args, shell: false };
  });
}

function configPlan(checks: ProofCheckConfig[]): PlannedCheck[] {
  // The whole command line goes to the shell as one string (no separate args array).
  return checks.map(({ name, command }) => ({ name, command, file: command, shell: true }));
}

/** Runs a command, showing its output as it comes (stdout to `out`, stderr to stderr) and keeping a copy of both. */
function runTeed(file: string, args: string[] | undefined, shell: boolean, cwd: string, out: NodeJS.WriteStream, env: NodeJS.ProcessEnv): Promise<{ status: number | null; signal: NodeJS.Signals | null; error?: Error; log: string }> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    let size = 0;
    const keep = (text: string) => {
      // The copy is only read for error messages: cap it so a very chatty suite cannot exhaust memory.
      if (size < 16 * 1024 * 1024) { chunks.push(text); size += text.length; }
    };
    const options = { cwd, env, shell, stdio: ['inherit', 'pipe', 'pipe'] as StdioOptions, windowsHide: true };
    // A shell command line (package scripts on Windows, .senior/config.json checks) is passed whole, without args.
    const child = args ? spawn(file, args, options) : spawn(file, options);
    if (!child.stdout || !child.stderr) throw new Error('no output pipes');
    child.stdout.setEncoding('utf8').on('data', (d: string) => { out.write(d); keep(d); });
    child.stderr.setEncoding('utf8').on('data', (d: string) => { process.stderr.write(d); keep(d); });
    child.on('error', (error) => resolve({ status: null, signal: null, error, log: chunks.join('') }));
    child.on('close', (status, signal) => resolve({ status, signal, log: chunks.join('') }));
  });
}

/**
 * Standard checks: the package scripts when there is a package.json (or no other project), then the Python, Go and
 * Rust checks for the projects in the repository (see ecosystems.ts).
 */
async function standardPlan(root: string, packageManager: string | null, changed: string[] | null): Promise<{ plan: PlannedCheck[]; others: boolean }> {
  const others = ecosystemPlan(root, changed).map((c): PlannedCheck => ({ ...c, shell: false }));
  const hasPackage = await exists(path.join(root, 'package.json'));
  const node = hasPackage || others.length === 0
    ? packageScriptPlan(await readJson<PackageJson>(path.join(root, 'package.json')), packageManager)
    : [];
  return { plan: [...node, ...others], others: others.length > 0 };
}

/** The commit the checks run on and whether the working tree has uncommitted changes; nulls outside git. */
function provenanceOf(root: string, knownDirty?: boolean | null): ProofReport['provenance'] {
  const git = (args: string[]) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return null;
    }
  };
  const head = git(['rev-parse', 'HEAD']);
  if (head === null) return { ranAt: new Date().toISOString(), head, dirty: null };
  if (knownDirty !== undefined) return { ranAt: new Date().toISOString(), head, dirty: knownDirty };
  const status = git(['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude).senior']);
  return { ranAt: new Date().toISOString(), head, dirty: status === null ? null : status.length > 0 };
}

export async function runProof(root: string, packageManager: string | null, options: ProofOptions = {}): Promise<ProofReport> {
  const provenance = provenanceOf(root, options.dirty);
  let source: ProofReport['source'] = 'config';
  let plan: PlannedCheck[];
  if (options.checks) plan = configPlan(options.checks);
  else {
    const standard = await standardPlan(root, packageManager, options.changed ?? null);
    plan = standard.plan;
    source = standard.others ? 'standard' : 'package-scripts';
  }
  const stdio: StdioOptions = options.childOutput === 'stderr' ? ['inherit', 2, 2] : 'inherit';
  const checks: ProofCheck[] = [];
  let blockedBy: string | null = null;
  let availableChecks = 0;

  // Python tools write bytecode and caches next to the code. Sent to a throwaway folder instead, they neither dirty the
  // repository (which would count as a change) nor leave stale bytecode that runs instead of an edited file.
  let cacheDir: string | null = null;
  const envFor = (planned: PlannedCheck): NodeJS.ProcessEnv | undefined => {
    if (!planned.pythonTool) return undefined;
    cacheDir ??= mkdtempSync(path.join(tmpdir(), 'senioros-py-'));
    return {
      ...process.env,
      PYTHONPYCACHEPREFIX: path.join(cacheDir, 'pycache'),
      MYPY_CACHE_DIR: path.join(cacheDir, 'mypy'),
      RUFF_CACHE_DIR: path.join(cacheDir, 'ruff'),
    };
  };

  try {
  for (const planned of plan) {
    const { name, command } = planned;
    if (command === null || planned.file === undefined) {
      checks.push({ name, command: null, status: 'skip', exitCode: null, durationMs: 0, reason: planned.skipReason ?? 'unavailable' });
      continue;
    }

    availableChecks += 1;
    if (blockedBy) {
      checks.push({ name, command, status: 'skip', exitCode: null, durationMs: 0, reason: `not run: "${blockedBy}" failed` });
      continue;
    }

    const started = Date.now();
    const cwd = planned.cwd ?? root;
    let result: { status: number | null; signal: NodeJS.Signals | null; error?: Error };
    let log = '';
    if (isTestCheck(name)) {
      // Test output is shown live and also read: for the number of tests that ran, and for Python, to tell an
      // uninstalled dependency from a broken change.
      const out = options.childOutput === 'stderr' ? process.stderr : process.stdout;
      // Piped output loses the runner's colours; keep them when a person is watching a terminal.
      const env = { ...(envFor(planned) ?? process.env), ...(out.isTTY ? { FORCE_COLOR: '1' } : {}) };
      const teed = await runTeed(planned.file, planned.args, planned.shell ?? false, cwd, out, env);
      result = teed;
      log = teed.log;
    } else {
      const spawnOptions = { cwd, stdio, shell: planned.shell ?? false, env: envFor(planned) };
      result = planned.args ? spawnSync(planned.file, planned.args, spawnOptions) : spawnSync(planned.file, spawnOptions);
    }
    const durationMs = Date.now() - started;

    if (result.error || result.status === null) {
      const reason = result.error
        ? `could not run "${command}": ${result.error.message}`
        : `terminated by signal ${result.signal ?? 'unknown'}`;
      checks.push({ name, command, status: 'fail', exitCode: null, durationMs, reason });
      blockedBy = name;
      continue;
    }

    const tests = isTestCheck(name) ? testsRan(log) : null;
    if (noTestsCollected(name, result.status, log) || (result.status === 0 && tests === 0)) {
      // A test command that ran nothing is not a failure, and not a pass either: its silence proves nothing.
      availableChecks -= 1;
      checks.push({ name, command, status: 'skip', exitCode: result.status, durationMs, reason: NO_TESTS, tests: 0 });
      continue;
    }
    const environment = result.status !== 0 && planned.python ? environmentFailure(log, planned.python) : null;
    if (environment) {
      // Not proven either way: reported, but it neither passes the baseline nor blames the change.
      checks.push({ name, command, status: 'skip', exitCode: result.status, durationMs, reason: environment });
      continue;
    }
    checks.push({ name, command, status: result.status === 0 ? 'pass' : 'fail', exitCode: result.status, durationMs, ...(tests !== null ? { tests } : {}) });
    if (result.status !== 0) blockedBy = name;
  }
  } finally {
    if (cacheDir) rmSync(cacheDir, { recursive: true, force: true });
  }

  const baselinePassed = availableChecks > 0 && checks.every((check) => check.status === 'pass' || check.command === null || check.reason === NO_TESTS);
  return { source, checks, provenance, baselinePassed, availableChecks, totalChecks: plan.length };
}
