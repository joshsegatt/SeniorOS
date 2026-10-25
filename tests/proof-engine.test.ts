import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ProofReport } from '../src/types.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/index.js');

async function project(scripts: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-proof-'));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'proof-fixture', version: '1.0.0', private: true, scripts }));
  return root;
}

function finish(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, 'finish', ...args], { cwd: root, encoding: 'utf8' });
}

test('finish --json keeps stdout parseable when scripts print output', async () => {
  const root = await project({ test: 'node -e "console.log(\'noisy test output\')"' });
  const run = finish(root, '--json');

  const report = JSON.parse(run.stdout) as ProofReport;
  assert.equal(report.baselinePassed, true);
  assert.equal(report.availableChecks, 1);
  assert.equal(report.checks.find((check) => check.name === 'test')?.status, 'pass');
  assert.match(run.stderr, /noisy test output/);
  assert.doesNotMatch(run.stdout, /noisy test output/);
  assert.equal(run.status, 0);
});

test('checks after a failure are reported as not run, never as pass', async () => {
  const root = await project({
    typecheck: 'node -e "process.exit(3)"',
    test: 'node -e "console.log(\'should not run\')"'
  });
  const run = finish(root, '--json');
  const report = JSON.parse(run.stdout) as ProofReport;

  assert.equal(report.baselinePassed, false);
  assert.equal(report.availableChecks, 2);
  assert.deepEqual(report.checks.map((check) => [check.name, check.status]), [
    ['typecheck', 'fail'],
    ['lint', 'skip'],
    ['test', 'skip'],
    ['build', 'skip']
  ]);
  assert.equal(report.checks[0]?.exitCode, 3);
  assert.match(report.checks[2]?.reason ?? '', /not run: "typecheck" failed/);
  assert.doesNotMatch(run.stderr, /should not run/);
  assert.equal(run.status, 1);
});

test('a project with no package.json is NOT PROVEN with an explicit reason', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-proof-empty-'));
  const run = finish(root, '--json');
  const report = JSON.parse(run.stdout) as ProofReport;

  assert.equal(report.baselinePassed, false);
  assert.equal(report.availableChecks, 0);
  assert.ok(report.checks.every((check) => check.status === 'skip' && check.reason === 'no package.json'));
  assert.equal(run.status, 1);
});

test('human output shows why a check was skipped', async () => {
  const root = await project({ test: 'node -e ""' });
  const run = finish(root);
  assert.match(run.stdout, /SKIP typecheck {2}\(no "typecheck" script in package\.json\)/);
  assert.match(run.stdout, /PROOF BASELINE: PASS \(1\/4 standard checks available\)/);
});
