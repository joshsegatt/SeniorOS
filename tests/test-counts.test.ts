import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const CLI = path.join(root, 'dist', 'src', 'index.js');
const { testsRan } = (await import(pathToFileURL(path.join(root, 'dist', 'src', 'core', 'test-counts.js')).href)) as {
  testsRan: (log: string) => number | null;
};
// Without NODE_TEST_CONTEXT, which turns a nested `node --test` into a reporting child that always exits 0.
const { NODE_TEST_CONTEXT: _parent, ...baseEnv } = process.env;

// Summary lines as each runner prints them. node:test, pytest, unittest and cargo were captured from real runs; Jest,
// Vitest, Mocha and go test follow their documented output.
const samples: Array<[string, string, number | null]> = [
  ['node:test, no test files', 'ℹ tests 0\nℹ suites 0\nℹ pass 0\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\n', 0],
  ['node:test, 2 run and 1 skipped', 'ℹ tests 3\nℹ suites 0\nℹ pass 2\nℹ fail 0\nℹ cancelled 0\nℹ skipped 1\nℹ todo 0\n', 2],
  ['node:test TAP', 'TAP version 13\nok 1 - a\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# skipped 0\n# todo 0\n', 1],
  ['Jest', 'PASS src/a.test.js\nTest Suites: 1 passed, 1 total\nTests:       1 skipped, 4 passed, 5 total\nSnapshots:   0 total\n', 4],
  ['Jest, no tests', 'No tests found, exiting with code 0\nRun with `--passWithNoTests` to exit with code 0\n', 0],
  ['Vitest', ' Test Files  2 passed (2)\n      Tests  1 failed | 6 passed (7)\n   Start at  10:00:00\n', 7],
  ['Vitest, no files', 'No test files found, exiting with code 0\n', 0],
  ['Mocha', '\n  3 passing (12ms)\n  1 failing\n', 4],
  ['Mocha, nothing', '\n  0 passing (1ms)\n', 0],
  ['pytest -q', '..F\n=== short test summary info ===\nFAILED test_y.py::test_f - assert 0\n2 passed, 1 failed, 1 skipped in 0.05s\n', 3],
  ['pytest, nothing', '\nno tests ran in 0.01s\n', 0],
  ['unittest', '..\n----------------------------------------------------------------------\nRan 2 tests in 0.000s\n\nOK\n', 2],
  ['unittest, nothing', '\n----------------------------------------------------------------------\nRan 0 tests in 0.000s\n\nNO TESTS RAN\n', 0],
  ['cargo, unit and doc-tests', 'running 2 tests\ntest result: ok. 2 passed; 0 failed; 0 ignored\n\nrunning 1 test\ntest result: ok. 1 passed; 0 failed; 0 ignored\n', 3],
  ['cargo, nothing', 'running 0 tests\ntest result: ok. 0 passed; 0 failed; 0 ignored\n\ntest result: ok. 0 passed; 0 failed; 0 ignored\n', 0],
  ['go test, no test files', '?   \texample.com/demo\t[no test files]\n?   \texample.com/demo/cmd\t[no test files]\n', 0],
  ['go test, some ran', 'ok  \texample.com/demo\t0.012s\n?   \texample.com/demo/cmd\t[no test files]\n', null],
  ['unknown runner', 'All good!\n', null],
  ['colours', '\x1b[32mℹ tests 0\x1b[39m\n', 0],
  // Several summaries in one run (review finding): an empty run must not hide one that ran tests.
  ['npm workspaces: 12 tests, then a package with none', 'ℹ tests 12\nℹ skipped 0\nℹ todo 0\nℹ tests 0\nℹ skipped 0\nℹ todo 0\n', 12],
  ['node --test with nothing, then Vitest', 'ℹ tests 0\nℹ skipped 0\n Test Files  3 passed (3)\n      Tests  40 passed (40)\n', 40],
  ['two pytest runs', '3 passed in 0.1s\nno tests ran in 0.01s\n', 3],
  ['go test that ran tests, next to node:test with none', 'ℹ tests 0\nok  \texample.com/demo\t0.012s\n', null],
];

test('the number of tests that ran is read from each runner, and unknown output says nothing', () => {
  for (const [label, log, expected] of samples) assert.equal(testsRan(log), expected, label);
});

function nodeProject(testFile: string | null) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cnt-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }));
  if (testFile) {
    mkdirSync(path.join(dir, 'test'));
    writeFileSync(path.join(dir, 'test', 'a.test.js'), testFile);
  }
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['add', '-A'], ['commit', '-q', '-m', 'init']]) {
    assert.equal(spawnSync('git', args, { cwd: dir }).status, 0);
  }
  return dir;
}

type Report = { checks: Array<{ name: string; status: string; tests?: number; reason?: string }>; baselinePassed: boolean; provenance: { head: string | null; dirty: boolean | null; ranAt: string }; recorded?: string };
const finish = (dir: string, ...flags: string[]) =>
  JSON.parse(spawnSync(process.execPath, [CLI, 'finish', '--json', ...flags], { cwd: dir, encoding: 'utf8', env: baseEnv }).stdout) as Report;

test('a test script that runs no tests is not a pass', () => {
  const dir = nodeProject(null);
  try {
    const report = finish(dir);
    const check = report.checks.find((c) => c.name === 'test');
    assert.equal(check?.status, 'skip', JSON.stringify(check));
    assert.equal(check?.reason, 'no tests ran');
    assert.equal(report.baselinePassed, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a passing suite reports how many tests ran, and --record keeps the evidence with its commit', () => {
  const dir = nodeProject("import t from 'node:test'; t('a', () => {}); t('b', () => {}); t.skip('c', () => {});\n");
  try {
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
    const report = finish(dir, '--record');
    assert.deepEqual(report.checks.find((c) => c.name === 'test')?.tests, 2);
    assert.equal(report.provenance.head, head);
    assert.equal(report.provenance.dirty, false);
    assert.ok(!Number.isNaN(Date.parse(report.provenance.ranAt)));

    assert.equal(report.recorded, `.senior/evidence/${head.slice(0, 12)}.json`);
    const saved = JSON.parse(readFileSync(path.join(dir, report.recorded ?? ''), 'utf8')) as Report & { senioros: string };
    assert.equal(saved.provenance.head, head);
    assert.match(saved.senioros, /^\d+\.\d+\.\d+$/);

    // Uncommitted changes are named as such, and the record itself is not a change that reruns anything.
    writeFileSync(path.join(dir, 'test', 'a.test.js'), "import t from 'node:test'; t('a', () => {});\n");
    const dirty = finish(dir, '--record');
    assert.equal(dirty.provenance.dirty, true);
    assert.equal(dirty.recorded, `.senior/evidence/${head.slice(0, 12)}-uncommitted.json`);
    assert.deepEqual(readdirSync(path.join(dir, '.senior', 'evidence')).sort(), [`${head.slice(0, 12)}-uncommitted.json`, `${head.slice(0, 12)}.json`]);
    assert.ok(!readFileSync(path.join(dir, report.recorded ?? ''), 'utf8').includes('ℹ'), 'no command output is stored');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a record is not a change: recording twice on a clean commit stays clean (review finding)', () => {
  const dir = nodeProject("import t from 'node:test'; t('a', () => {});\n");
  try {
    const first = finish(dir, '--record');
    const second = finish(dir, '--record');
    assert.equal(second.provenance.dirty, false);
    assert.equal(second.recorded, first.recorded);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('without --record nothing is written', () => {
  const dir = nodeProject("import t from 'node:test'; t('a', () => {});\n");
  try {
    finish(dir);
    assert.equal(existsSync(path.join(dir, '.senior')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
