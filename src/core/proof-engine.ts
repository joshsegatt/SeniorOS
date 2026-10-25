import path from 'node:path';
import { spawnSync, type StdioOptions } from 'node:child_process';
import { readJson } from './fs-utils.js';
import type { ProofCheck, ProofReport } from '../types.js';
import type { ProofCheckConfig } from './config.js';

interface PackageJson {
  scripts?: Record<string, string>;
}

const ORDER = ['typecheck', 'lint', 'test', 'build'] as const;

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
}

interface PlannedCheck {
  name: string;
  /** Display command; null when the check is unavailable. */
  command: string | null;
  skipReason?: string;
  file?: string;
  args?: string[];
  shell?: boolean;
}

function packageScriptPlan(pkg: PackageJson | null, packageManager: string | null): PlannedCheck[] {
  const scripts = pkg?.scripts ?? {};
  const manager = packageRunner(packageManager);
  return ORDER.map((name) => {
    if (!scripts[name]) {
      return { name, command: null, skipReason: pkg ? `no "${name}" script in package.json` : 'no package.json' };
    }
    const args = argsFor(manager, name);
    return { name, command: `${manager} ${args.join(' ')}`, file: manager, args, shell: process.platform === 'win32' };
  });
}

function configPlan(checks: ProofCheckConfig[]): PlannedCheck[] {
  // The whole command line goes to the shell as one string (no separate args array).
  return checks.map(({ name, command }) => ({ name, command, file: command, shell: true }));
}

export async function runProof(root: string, packageManager: string | null, options: ProofOptions = {}): Promise<ProofReport> {
  const source: ProofReport['source'] = options.checks ? 'config' : 'package-scripts';
  const plan = options.checks
    ? configPlan(options.checks)
    : packageScriptPlan(await readJson<PackageJson>(path.join(root, 'package.json')), packageManager);
  const stdio: StdioOptions = options.childOutput === 'stderr' ? ['inherit', 2, 2] : 'inherit';
  const checks: ProofCheck[] = [];
  let blockedBy: string | null = null;
  let availableChecks = 0;

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
    const spawnOptions = { cwd: root, stdio, shell: planned.shell ?? false };
    const result = planned.args ? spawnSync(planned.file, planned.args, spawnOptions) : spawnSync(planned.file, spawnOptions);
    const durationMs = Date.now() - started;

    if (result.error || result.status === null) {
      const reason = result.error
        ? `could not run "${command}": ${result.error.message}`
        : `terminated by signal ${result.signal ?? 'unknown'}`;
      checks.push({ name, command, status: 'fail', exitCode: null, durationMs, reason });
      blockedBy = name;
      continue;
    }

    checks.push({ name, command, status: result.status === 0 ? 'pass' : 'fail', exitCode: result.status, durationMs });
    if (result.status !== 0) blockedBy = name;
  }

  const baselinePassed = availableChecks > 0 && checks.every((check) => check.status === 'pass' || check.command === null);
  return { source, checks, baselinePassed, availableChecks, totalChecks: plan.length };
}
