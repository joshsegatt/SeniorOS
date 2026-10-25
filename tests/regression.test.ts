import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ProofError, proveRegression } from '../src/core/regression.js';
import type { RegressionReport } from '../src/core/regression.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/index.js');

const BUGGY = 'exports.total = (items) => items.reduce((sum, item) => sum + item.price, 0) * 1.1;\n';
const FIXED = 'exports.total = (items) => items.reduce((sum, item) => sum + item.price, 0);\n';
const TEST = [
  'const { total } = require("../src/cart");',
  'const got = total([{ price: 10 }]);',
  'if (got !== 10) { console.error("expected 10, got " + got); process.exit(1); }',
  'console.log("ok");',
  ''
].join('\n');

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

async function write(root: string, relative: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
  await writeFile(path.join(root, relative), content);
}

/** A repository with a committed bug, the fix in the working tree and a new regression test. */
async function fixedRepo(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-prove-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'SeniorOS Test');
  git(root, 'config', 'core.autocrlf', 'false');
  git(root, 'checkout', '-q', '-b', 'main');
  await write(root, 'src/cart.js', BUGGY);
  await write(root, 'README.md', 'demo\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'buggy cart');
  await write(root, 'src/cart.js', FIXED);
  await write(root, 'tests/cart.test.js', TEST);
  return root;
}

function snapshot(root: string): string {
  const status = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all');
  const files = status.split('\0').filter(Boolean).map((entry) => entry.slice(3)).sort();
  const hashes = files.map((file) => {
    const absolute = path.join(root, file);
    return `${file}:${existsSync(absolute) ? createHash('sha256').update(readFileSync(absolute)).digest('hex') : 'missing'}`;
  });
  return `${status}\n${hashes.join('\n')}`;
}

test('a real fix with a test that catches the bug is PROVEN, and the tree is left byte-identical', async () => {
  const root = await fixedRepo();
  const before = snapshot(root);
  const report = proveRegression(root, { test: 'node tests/cart.test.js', expectFailure: 'expected 10' });

  assert.equal(report.verdict, 'proven');
  assert.deepEqual(report.runs.map((run) => [run.phase, run.passed]), [['with-fix', true], ['without-fix', false], ['restored', true]]);
  assert.deepEqual(report.fixFiles, ['src/cart.js']);
  assert.deepEqual(report.testFiles, ['tests/cart.test.js']);
  assert.match(report.runs[1]!.outputTail, /expected 10, got 11/);
  assert.equal(report.restored.verified, true);
  assert.equal(snapshot(root), before, 'working tree and git status must be unchanged');
  assert.ok(report.evidencePath && existsSync(path.join(root, report.evidencePath)), 'evidence file is written');
  assert.ok(!existsSync(path.join(root, '.senior/runtime/prove/active')), 'backup is removed after a verified restore');
});

test('a test that passes without the fix does not prove anything', async () => {
  const root = await fixedRepo();
  await write(root, 'tests/cart.test.js', 'console.log("always green");\n');
  const before = snapshot(root);
  const report = proveRegression(root, { test: 'node tests/cart.test.js' });
  assert.equal(report.verdict, 'not-proven');
  assert.equal(report.reason, 'test-misses-bug');
  assert.equal(snapshot(root), before);
});

test('an incomplete fix is reported before anything is reverted', async () => {
  const root = await fixedRepo();
  await write(root, 'src/cart.js', 'exports.total = () => 9;\n');
  const before = snapshot(root);
  const report = proveRegression(root, { test: 'node tests/cart.test.js' });
  assert.equal(report.reason, 'fix-fails-test');
  assert.equal(report.runs.length, 1);
  assert.equal(report.restored.files, 0);
  assert.equal(snapshot(root), before);
});

test('failing for a different reason than --expect-failure is not proof', async () => {
  const root = await fixedRepo();
  const report = proveRegression(root, { test: 'node tests/cart.test.js', expectFailure: 'TypeError' });
  assert.equal(report.reason, 'failed-for-other-reason');
});

test('a test that fails again after the fix is restored is flagged as unstable', async () => {
  const root = await fixedRepo();
  const counter = path.join(await mkdtemp(path.join(os.tmpdir(), 'senior-flaky-')), 'count');
  await write(root, 'tests/flaky.test.js', [
    'const fs = require("fs");',
    `const file = ${JSON.stringify(counter)};`,
    'const n = (fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8")) : 0) + 1;',
    'fs.writeFileSync(file, String(n));',
    'process.exit(n === 1 ? 0 : 1);',
    ''
  ].join('\n'));
  const report = proveRegression(root, { test: 'node tests/flaky.test.js' });
  assert.equal(report.reason, 'unstable');
});

test('added, deleted and renamed fix files are reverted and restored exactly', async () => {
  const root = await fixedRepo();
  await write(root, 'src/legacy.js', 'module.exports = 1;\n');
  await write(root, 'src/old-name.js', 'module.exports = "old";\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'more files');
  // The fix: add a helper, delete a legacy file and rename another, on top of the cart change.
  await write(root, 'src/tax.js', 'exports.rate = 0;\n');
  git(root, 'rm', '-q', 'src/legacy.js');
  git(root, 'mv', 'src/old-name.js', 'src/new-name.js');
  await write(root, 'tests/cart.test.js', `${TEST}if (!require("fs").existsSync(__dirname + "/../src/tax.js")) process.exit(2);\n`);
  const before = snapshot(root);

  const report = proveRegression(root, { test: 'node tests/cart.test.js' });
  assert.equal(report.verdict, 'proven', report.message);
  assert.ok(report.fixFiles.includes('src/tax.js') && report.fixFiles.includes('src/legacy.js') && report.fixFiles.includes('src/new-name.js'));
  assert.equal(snapshot(root), before);
  assert.ok(!existsSync(path.join(root, 'src/old-name.js')), 'rename source is gone again after restore');
  assert.ok(!existsSync(path.join(root, 'src/legacy.js')), 'deleted file is deleted again after restore');
});

test('committed branch work is proven against --base, and without it there is nothing to revert', async () => {
  const root = await fixedRepo();
  git(root, 'checkout', '-q', '-b', 'fix/cart');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'fix cart and add test');

  assert.throws(() => proveRegression(root, { test: 'node tests/cart.test.js' }), (error: unknown) => error instanceof ProofError && /No changes relative to HEAD/.test(error.message));
  const report = proveRegression(root, { test: 'node tests/cart.test.js', base: 'main' });
  assert.equal(report.verdict, 'proven');
  assert.equal(report.scope, 'base');
  assert.equal(git(root, 'status', '--porcelain'), '', 'a clean branch stays clean');
});

test('--fix selects the fix explicitly and rejects patterns that match nothing', async () => {
  const root = await fixedRepo();
  await write(root, 'docs/notes.md', 'unrelated\n');
  const report = proveRegression(root, { test: 'node tests/cart.test.js', fix: ['src/**'] });
  assert.deepEqual(report.fixFiles, ['src/cart.js']);
  assert.ok(report.testFiles.includes('docs/notes.md'));
  assert.throws(() => proveRegression(root, { test: 'node tests/cart.test.js', fix: ['lib/**'] }), /--fix matches no changed file: lib\/\*\*/);
});

test('when only tests changed, it asks for --fix instead of guessing', async () => {
  const root = await fixedRepo();
  await write(root, 'src/cart.js', BUGGY);
  assert.throws(() => proveRegression(root, { test: 'node tests/cart.test.js' }), /Every changed file looks like a test/);
});

test('outside a git repository it fails loudly', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-prove-nogit-'));
  const previous = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = path.dirname(root);
  try {
    assert.throws(() => proveRegression(root, { test: 'node -e ""' }), /Not a git repository/);
  } finally {
    if (previous === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
    else process.env.GIT_CEILING_DIRECTORIES = previous;
  }
});

test('a hard kill mid-proof leaves a backup; the next proof refuses and --restore puts everything back', async () => {
  const root = await fixedRepo();
  // Hangs only while the fix is reverted, so the CLI can be killed during run 2.
  await write(root, 'tests/hang.test.js', [
    'const fs = require("fs");',
    'const fixed = !fs.readFileSync(__dirname + "/../src/cart.js", "utf8").includes("1.1");',
    'if (fixed) process.exit(0);',
    'setTimeout(() => process.exit(1), 20000);',
    ''
  ].join('\n'));
  const before = snapshot(root);
  const manifest = path.join(root, '.senior/runtime/prove/active/manifest.json');

  const child = spawn(process.execPath, [CLI, 'prove', '--regression', '--test', 'node tests/hang.test.js'], { cwd: root, stdio: 'ignore' });
  const deadline = Date.now() + 15000;
  while (!existsSync(manifest) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(existsSync(manifest), 'proof reached the reverted state');
  await new Promise((resolve) => setTimeout(resolve, 300));
  child.kill('SIGKILL');
  await new Promise((resolve) => child.once('exit', resolve));

  assert.equal(await readFile(path.join(root, 'src/cart.js'), 'utf8'), BUGGY, 'the kill left the fix reverted');
  const refused = spawnSync(process.execPath, [CLI, 'prove', '--regression', '--test', 'node tests/cart.test.js'], { cwd: root, encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /previous proof was interrupted.*senior prove --restore/s);

  const restore = spawnSync(process.execPath, [CLI, 'prove', '--restore'], { cwd: root, encoding: 'utf8' });
  assert.equal(restore.status, 0, restore.stderr);
  assert.match(restore.stdout, /Restored and verified 1 file/);
  assert.equal(snapshot(root), before, 'working tree is byte-identical to before the proof');
});

test('CLI: --json is parseable and exit codes follow the verdict', async () => {
  const root = await fixedRepo();
  const proven = spawnSync(process.execPath, [CLI, 'prove', '--regression', '--test', 'node tests/cart.test.js', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(proven.status, 0, proven.stderr);
  assert.equal((JSON.parse(proven.stdout) as RegressionReport).verdict, 'proven');

  await write(root, 'tests/cart.test.js', 'console.log("always green");\n');
  const missed = spawnSync(process.execPath, [CLI, 'prove', '--regression', '--test', 'node tests/cart.test.js'], { cwd: root, encoding: 'utf8' });
  assert.equal(missed.status, 1);
  assert.match(missed.stdout, /NOT PROVEN \(test-misses-bug\)/);

  const usage = spawnSync(process.execPath, [CLI, 'prove', '--regression'], { cwd: root, encoding: 'utf8' });
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /requires --test/);
});
