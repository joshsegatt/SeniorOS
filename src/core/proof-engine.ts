import path from 'node:path';
import { spawnSync, type StdioOptions } from 'node:child_process';
import { readJson } from './fs-utils.js';
import type { ProofCheck, ProofReport } from '../types.js';

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
}

export async function runProof(root: string, packageManager: string | null, options: ProofOptions = {}): Promise<ProofReport> {
  const pkg = await readJson<PackageJson>(path.join(root, 'package.json'));
  const scripts = pkg?.scripts ?? {};
  const manager = packageRunner(packageManager);
  const checks: ProofCheck[] = [];
  const stdio: StdioOptions = options.childOutput === 'stderr' ? ['inherit', 2, 2] : 'inherit';
  let blockedBy: string | null = null;
  let availableChecks = 0;

  for (const name of ORDER) {
    if (!scripts[name]) {
      const reason = pkg ? `no "${name}" script in package.json` : 'no package.json';
      checks.push({ name, command: null, status: 'skip', exitCode: null, durationMs: 0, reason });
      continue;
    }

    availableChecks += 1;
    const command = `${manager} ${argsFor(manager, name).join(' ')}`;
    if (blockedBy) {
      checks.push({ name, command, status: 'skip', exitCode: null, durationMs: 0, reason: `not run: "${blockedBy}" failed` });
      continue;
    }

    const started = Date.now();
    const result = spawnSync(manager, argsFor(manager, name), {
      cwd: root,
      stdio,
      shell: process.platform === 'win32'
    });
    const durationMs = Date.now() - started;

    if (result.error || result.status === null) {
      const reason = result.error
        ? `could not run ${manager}: ${result.error.message}`
        : `terminated by signal ${result.signal ?? 'unknown'}`;
      checks.push({ name, command, status: 'fail', exitCode: null, durationMs, reason });
      blockedBy = name;
      continue;
    }

    checks.push({ name, command, status: result.status === 0 ? 'pass' : 'fail', exitCode: result.status, durationMs });
    if (result.status !== 0) blockedBy = name;
  }

  const baselinePassed = availableChecks > 0 && checks.every((check) => check.status === 'pass' || check.command === null);
  return { checks, baselinePassed, availableChecks, totalChecks: ORDER.length };
}
