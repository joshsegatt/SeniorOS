import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();

test('bench grader passes every good reference solution and fails every bad or no-op one', () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'sob-'));
  try {
    const result = spawnSync(process.execPath, [path.join(root, 'evals', 'bench', 'bench.mjs'), 'selftest'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SENIOROS_BENCH_HOME: home },
      timeout: 300_000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Grader verified/);
    assert.doesNotMatch(result.stdout, /MISMATCH|MISSING/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
