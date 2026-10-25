import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

export async function runProof(root: string, packageManager: string | null): Promise<ProofReport> {
  const pkg = await readJson<PackageJson>(path.join(root, 'package.json'));
  const scripts = pkg?.scripts ?? {};
  const manager = packageRunner(packageManager);
  const checks: ProofCheck[] = [];

  for (const name of ORDER) {
    if (!scripts[name]) {
      checks.push({ name, command: null, status: 'skip', exitCode: null, durationMs: 0 });
      continue;
    }

    const command = `${manager} ${argsFor(manager, name).join(' ')}`;
    const started = Date.now();
    const result = spawnSync(manager, argsFor(manager, name), {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    const durationMs = Date.now() - started;
    const exitCode = result.status ?? 1;
    checks.push({ name, command, status: exitCode === 0 ? 'pass' : 'fail', exitCode, durationMs });
    if (exitCode !== 0) break;
  }

  const ran = checks.filter((check) => check.status !== 'skip');
  const baselinePassed = ran.length > 0 && ran.every((check) => check.status === 'pass');
  return { checks, baselinePassed, availableChecks: ran.length, totalChecks: ORDER.length };
}
