import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GitError, getChangeSet, parseNameStatusZ, parseStatusZ } from '../src/core/git.js';
import { assessRisk } from '../src/core/risk-engine.js';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

async function write(root: string, relative: string, content = 'x\n'): Promise<void> {
  await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
  await writeFile(path.join(root, relative), content);
}

async function repo(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-git-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'SeniorOS Test');
  git(root, 'config', 'core.autocrlf', 'false');
  git(root, 'checkout', '-q', '-b', 'main');
  await write(root, 'README.md', 'baseline\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'init');
  return root;
}

test('parseStatusZ keeps the new path for renames and raw UTF-8 paths', () => {
  const output = ' M ação.ts\0R  new.txt\0old.txt\0?? d/e/u.sql\0';
  assert.deepEqual(parseStatusZ(output), [
    { status: 'M', path: 'ação.ts' },
    { status: 'R', path: 'new.txt' },
    { status: '??', path: 'd/e/u.sql' }
  ]);
});

test('parseNameStatusZ keeps the new path for renames', () => {
  const output = 'M\0ação.ts\0A\0d/e/u.sql\0R100\0old.txt\0new.txt\0';
  assert.deepEqual(parseNameStatusZ(output), [
    { status: 'M', path: 'ação.ts' },
    { status: 'A', path: 'd/e/u.sql' },
    { status: 'R', path: 'new.txt' }
  ]);
});

test('non-ASCII paths are not C-quoted, so risk rules still match them', async () => {
  const root = await repo();
  await write(root, 'src/auth/sessão.ts');
  const { files } = getChangeSet(root);
  assert.ok(files.some((file) => file.path === 'src/auth/sessão.ts'));
  assert.ok(assessRisk(files).signals.some((signal) => signal.code === 'auth'));
});

test('committed branch changes are invisible to working-tree scope but caught with --base', async () => {
  const root = await repo();
  git(root, 'checkout', '-q', '-b', 'feature');
  await write(root, 'src/auth/session.ts');
  await write(root, 'migrations/002.sql', 'drop table users;\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'auth + migration');

  const workingTree = getChangeSet(root);
  assert.deepEqual(workingTree.scope, { mode: 'working-tree' });
  assert.equal(workingTree.files.length, 0);

  const branch = getChangeSet(root, { base: 'main' });
  assert.equal(branch.scope.mode, 'base');
  assert.deepEqual(branch.files.map((file) => file.path).sort(), ['migrations/002.sql', 'src/auth/session.ts']);
  assert.equal(assessRisk(branch.files).level, 'high');
});

test('--base also includes uncommitted and untracked work on top of the branch', async () => {
  const root = await repo();
  git(root, 'checkout', '-q', '-b', 'feature');
  await write(root, 'src/routes/users.ts');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'route');
  await write(root, 'README.md', 'edited\n');
  await write(root, '.github/workflows/deploy.yml');

  const paths = getChangeSet(root, { base: 'main' }).files.map((file) => file.path).sort();
  assert.deepEqual(paths, ['.github/workflows/deploy.yml', 'README.md', 'src/routes/users.ts']);
});

test('works from a subdirectory and reports repository-relative paths', async () => {
  const root = await repo();
  await write(root, 'packages/api/migrations/001.sql');
  const { files } = getChangeSet(path.join(root, 'packages'));
  assert.deepEqual(files.map((file) => file.path), ['packages/api/migrations/001.sql']);
});

test('an unknown base ref is an actionable error, not low risk', async () => {
  const root = await repo();
  assert.throws(() => getChangeSet(root, { base: 'does-not-exist' }), (error: unknown) =>
    error instanceof GitError && /does not exist/.test(error.message));
});

test('option-like base refs are rejected', async () => {
  const root = await repo();
  assert.throws(() => getChangeSet(root, { base: '--output=/tmp/x' }), GitError);
});

test('outside a git repository the CLI fails loudly instead of reporting low risk', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-nogit-'));
  const previous = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = path.dirname(root);
  try {
    assert.throws(() => getChangeSet(root), (error: unknown) =>
      error instanceof GitError && /Not a git repository/.test(error.message));
  } finally {
    if (previous === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
    else process.env.GIT_CEILING_DIRECTORIES = previous;
  }
});
