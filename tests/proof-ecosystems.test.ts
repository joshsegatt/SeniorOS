import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const CLI = path.join(root, 'dist', 'src', 'index.js');
// Without NODE_TEST_CONTEXT, which turns a nested `node --test` into a reporting child that always exits 0.
const { NODE_TEST_CONTEXT: _parent, ...baseEnv } = process.env;

type Check = { name: string; status: string; command: string | null; reason?: string };
type Report = { source: string; checks: Check[]; baselinePassed: boolean };

const available = (file: string, args: string[]) => {
  const r = spawnSync(file, args, { stdio: 'ignore', windowsHide: true });
  return !r.error && r.status === 0;
};
const PYTHON = ['python3', 'python', 'py'].find((p) => available(p, ['--version']));
const HAS_CARGO = available('cargo', ['--version']);
const HAS_GO = available('go', ['version']);

function project(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'eco-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

function finish(dir: string, env: NodeJS.ProcessEnv = baseEnv): Report {
  const r = spawnSync(process.execPath, [CLI, 'finish', '--json'], { cwd: dir, encoding: 'utf8', env, timeout: 600_000 });
  return JSON.parse(r.stdout) as Report;
}

const byName = (report: Report, name: string) => report.checks.find((c) => c.name === name);

test('Python: tests run, a failing test fails the baseline, no tests is not a pass', { skip: !PYTHON && 'python not installed' }, () => {
  const dir = project({
    'pyproject.toml': '[project]\nname = "demo"\nversion = "0.1.0"\n',
    'calc.py': 'def add(a, b):\n    return a + b\n',
    'tests/test_calc.py': 'import unittest\nimport sys, os\nsys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))\nfrom calc import add\n\nclass T(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 2), 4)\n',
    'tests/__init__.py': '',
  });
  try {
    const ok = finish(dir);
    assert.equal(ok.source, 'standard');
    assert.equal(byName(ok, 'python test')?.status, 'pass', JSON.stringify(ok));
    assert.equal(ok.baselinePassed, true);
    assert.equal(byName(ok, 'test'), undefined, 'no package.json: no Node checks listed');

    writeFileSync(path.join(dir, 'calc.py'), 'def add(a, b):\n    return a - b\n');
    const broken = finish(dir);
    assert.equal(byName(broken, 'python test')?.status, 'fail');
    assert.equal(broken.baselinePassed, false);

    rmSync(path.join(dir, 'tests'), { recursive: true, force: true });
    const empty = finish(dir);
    assert.equal(byName(empty, 'python test')?.status, 'skip', JSON.stringify(empty));
    assert.equal(empty.baselinePassed, false, 'nothing verified is not a pass');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Rust: cargo test runs and a failing test fails the baseline', { skip: !HAS_CARGO && 'cargo not installed' }, () => {
  const dir = project({
    'Cargo.toml': '[package]\nname = "demo"\nversion = "0.1.0"\nedition = "2021"\n\n[lib]\npath = "src/lib.rs"\n',
    'src/lib.rs': 'pub fn add(a: i32, b: i32) -> i32 { a + b }\n\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn adds() { assert_eq!(super::add(2, 2), 4); }\n}\n',
  });
  try {
    assert.equal(byName(finish(dir), 'rust test')?.status, 'pass');
    writeFileSync(path.join(dir, 'src', 'lib.rs'), 'pub fn add(a: i32, b: i32) -> i32 { a - b }\n\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn adds() { assert_eq!(super::add(2, 2), 4); }\n}\n');
    const broken = finish(dir);
    assert.equal(byName(broken, 'rust test')?.status, 'fail');
    assert.equal(broken.baselinePassed, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Go: vet and test run, and a failing test fails the baseline', { skip: !HAS_GO && 'go not installed' }, () => {
  const dir = project({
    'go.mod': 'module example.com/demo\n\ngo 1.21\n',
    'calc.go': 'package demo\n\nfunc Add(a, b int) int { return a + b }\n',
    'calc_test.go': 'package demo\n\nimport "testing"\n\nfunc TestAdd(t *testing.T) {\n\tif Add(2, 2) != 4 {\n\t\tt.Fatal("wrong")\n\t}\n}\n',
  });
  try {
    const ok = finish(dir);
    assert.equal(byName(ok, 'go vet')?.status, 'pass', JSON.stringify(ok));
    assert.equal(byName(ok, 'go test')?.status, 'pass');
    writeFileSync(path.join(dir, 'calc.go'), 'package demo\n\nfunc Add(a, b int) int { return a - b }\n');
    assert.equal(byName(finish(dir), 'go test')?.status, 'fail');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing toolchain is reported as skipped, never as passed', () => {
  const dir = project({ 'go.mod': 'module example.com/demo\n\ngo 1.21\n', 'Cargo.toml': '[package]\nname = "d"\nversion = "0.1.0"\n' });
  const empty = mkdtempSync(path.join(os.tmpdir(), 'nopath-'));
  try {
    const report = finish(dir, { ...baseEnv, PATH: empty, Path: empty });
    for (const name of ['go vet', 'go test', 'rust test']) {
      const c = byName(report, name);
      assert.equal(c?.status, 'skip', name);
      assert.match(c?.reason ?? '', /not found/);
    }
    assert.equal(report.baselinePassed, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(empty, { recursive: true, force: true });
  }
});

test('a Node and Python repository runs both', { skip: !PYTHON && 'python not installed' }, () => {
  const dir = project({
    'package.json': JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }),
    'requirements.txt': '',
    'test_a.py': 'import unittest\n\nclass T(unittest.TestCase):\n    def test_ok(self):\n        self.assertTrue(True)\n',
  });
  try {
    const report = finish(dir);
    assert.equal(byName(report, 'test')?.status, 'pass');
    assert.equal(byName(report, 'python test')?.status, 'pass', JSON.stringify(report));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the finish gate now covers a Python repository', { skip: !PYTHON && 'python not installed' }, async () => {
  const dir = project({
    'pyproject.toml': '[project]\nname = "demo"\nversion = "0.1.0"\n',
    'calc.py': 'def add(a, b):\n    return a + b\n',
    'test_calc.py': 'import unittest\nfrom calc import add\n\nclass T(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 2), 4)\n',
  });
  const git = (...args: string[]) => assert.equal(spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).status, 0);
  const saved = process.env.SENIOROS_CLI;
  try {
    git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('add', '-A'); git('commit', '-q', '-m', 'init');
    writeFileSync(path.join(dir, 'calc.py'), 'def add(a, b):\n    return a - b\n');
    process.env.SENIOROS_CLI = `"${process.execPath}" "${CLI}"`;
    const { evaluate } = (await import(pathToFileURL(path.join(root, 'adapters', 'shared', 'finish-gate.mjs')).href)) as {
      evaluate: (i: { cwd: string; sessionId: string; host: string }) => string | null;
    };
    assert.match(evaluate({ cwd: dir, sessionId: `py${process.pid}`, host: 'test' }) ?? '', /FAIL python test/);
  } finally {
    if (saved === undefined) delete process.env.SENIOROS_CLI;
    else process.env.SENIOROS_CLI = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

function gitRepo(dir: string) {
  const git = (...args: string[]) => assert.equal(spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).status, 0, args.join(' '));
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('add', '-A'); git('commit', '-q', '-m', 'init');
}

const pyTest = (body: string) => `import unittest\n\nclass T(unittest.TestCase):\n    def test_it(self):\n${body}\n`;

test('projects in subfolders are found, and only the ones a change touches run', { skip: !PYTHON && 'python not installed' }, () => {
  const dir = project({
    'api/pyproject.toml': '[project]\nname = "api"\nversion = "0.1.0"\n',
    'api/test_api.py': pyTest('        self.assertTrue(True)'),
    'worker/requirements.txt': '',
    'worker/test_worker.py': pyTest('        self.assertTrue(True)'),
    'README.md': '# demo\n',
  });
  try {
    gitRepo(dir);
    const clean = finish(dir);
    assert.equal(byName(clean, 'python test (api)')?.status, 'pass', 'a clean tree runs every project');
    assert.equal(byName(clean, 'python test (worker)')?.status, 'pass');

    writeFileSync(path.join(dir, 'api', 'test_api.py'), pyTest('        self.assertEqual(1, 1)'));
    const changed = finish(dir);
    assert.equal(byName(changed, 'python test (api)')?.status, 'pass', JSON.stringify(changed));
    assert.equal(byName(changed, 'python test (worker)')?.status, 'skip');
    assert.match(byName(changed, 'python test (worker)')?.reason ?? '', /no changes in this project/);

    const r = spawnSync(process.execPath, [CLI, 'finish', '--all', '--json'], { cwd: dir, encoding: 'utf8', env: baseEnv });
    assert.equal(byName(JSON.parse(r.stdout) as Report, 'python test (worker)')?.status, 'pass', '--all runs everything');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Cargo workspace members are covered by the workspace, not listed again', async () => {
  const dir = project({
    'Cargo.toml': '[workspace]\nmembers = ["crates/a"]\n',
    'crates/a/Cargo.toml': '[package]\nname = "a"\nversion = "0.1.0"\n',
    'services/api/go.mod': 'module example.com/api\n\ngo 1.21\n',
    'node_modules/dep/pyproject.toml': '',
  });
  try {
    const { discoverProjects } = (await import(pathToFileURL(path.join(root, 'dist', 'src', 'core', 'ecosystems.js')).href)) as {
      discoverProjects: (r: string) => Array<{ dir: string; kinds: string[] }>;
    };
    const found = discoverProjects(dir).map((p) => [path.relative(dir, p.dir).split(path.sep).join('/'), p.kinds.join(',')]);
    assert.deepEqual(found, [['', 'rust'], ['services/api', 'go']]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a declared but uninstalled dependency is not blamed on the change; anything else still fails', { skip: !PYTHON && 'python not installed' }, () => {
  const imports = (module: string) => `import unittest\nimport ${module}\n\nclass T(unittest.TestCase):\n    def test_it(self):\n        self.assertTrue(True)\n`;
  const cases: Array<[string, Record<string, string>, string, RegExp | null]> = [
    ['declared, not installed', { 'requirements.txt': 'senioros-fake-dep>=1.0\n', 'test_a.py': imports('senioros_fake_dep') }, 'skip', /declared dependencies not installed/],
    ['not declared', { 'requirements.txt': 'other-package\n', 'test_a.py': imports('senioros_fake_dep') }, 'fail', null],
    ['the project\'s own module', { 'requirements.txt': '', 'calc/__init__.py': 'raise ImportError("No module named \'calc\'")\n', 'test_a.py': imports('calc') }, 'fail', null],
    ['a real failure next to it', {
      'requirements.txt': 'senioros-fake-dep\n',
      'test_a.py': imports('senioros_fake_dep'),
      'test_b.py': pyTest('        self.assertEqual(1, 2)'),
    }, 'fail', null],
  ];
  for (const [label, files, status, reason] of cases) {
    const dir = project(files);
    try {
      const check = byName(finish(dir), 'python test');
      assert.equal(check?.status, status, `${label}: ${JSON.stringify(check)}`);
      if (reason) assert.match(check?.reason ?? '', reason, label);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// Review findings on the first version of this change.

test('the finish gate and the proof engine find projects with the same rule', async () => {
  const lib = (await import(pathToFileURL(path.join(root, 'adapters', 'antigravity', 'hooks', 'lib.mjs')).href)) as {
    PROJECT_MANIFESTS: string[]; IGNORED_DIRS: RegExp; MAX_DEPTH: number; hasProofSource: (r: string) => boolean;
  };
  const eco = (await import(pathToFileURL(path.join(root, 'dist', 'src', 'core', 'ecosystems.js')).href)) as {
    PROJECT_MANIFESTS: string[]; IGNORED_DIRS: RegExp; MAX_DEPTH: number;
  };
  assert.deepEqual(lib.PROJECT_MANIFESTS, eco.PROJECT_MANIFESTS);
  assert.equal(lib.IGNORED_DIRS.source, eco.IGNORED_DIRS.source);
  assert.equal(lib.MAX_DEPTH, eco.MAX_DEPTH);

  const sub = project({ 'services/api/go.mod': 'module x\n', 'node_modules/dep/pyproject.toml': '' });
  const deps = project({ 'node_modules/dep/pyproject.toml': '', 'a/b/c/go.mod': 'module x\n' });
  try {
    assert.equal(lib.hasProofSource(sub), true, 'a project two folders down');
    assert.equal(lib.hasProofSource(deps), false, 'dependencies and folders deeper than two levels do not count');
  } finally {
    rmSync(sub, { recursive: true, force: true });
    rmSync(deps, { recursive: true, force: true });
  }
});

test('the finish gate covers a repository whose only project is in a subfolder', { skip: !PYTHON && 'python not installed' }, async () => {
  const dir = project({
    'backend/pyproject.toml': '[project]\nname = "backend"\nversion = "0.1.0"\n',
    'backend/calc.py': 'def add(a, b):\n    return a + b\n',
    'backend/test_calc.py': 'import unittest\nfrom calc import add\n\nclass T(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 2), 4)\n',
  });
  const saved = process.env.SENIOROS_CLI;
  try {
    gitRepo(dir);
    writeFileSync(path.join(dir, 'backend', 'calc.py'), 'def add(a, b):\n    return a - b\n');
    process.env.SENIOROS_CLI = `"${process.execPath}" "${CLI}"`;
    const { evaluate } = (await import(pathToFileURL(path.join(root, 'adapters', 'shared', 'finish-gate.mjs')).href)) as {
      evaluate: (i: { cwd: string; sessionId: string; host: string }) => string | null;
    };
    assert.match(evaluate({ cwd: dir, sessionId: `sub${process.pid}`, host: 'test' }) ?? '', /FAIL python test \(backend\)/);
  } finally {
    if (saved === undefined) delete process.env.SENIOROS_CLI;
    else process.env.SENIOROS_CLI = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing declared dependency does not hide another error in the same run', { skip: !PYTHON && 'python not installed' }, () => {
  const dir = project({
    'requirements.txt': 'senioros-fake-dep\n',
    'test_a.py': 'import unittest\nimport senioros_fake_dep\n\nclass T(unittest.TestCase):\n    def test_it(self):\n        self.assertTrue(True)\n',
    'test_b.py': 'import unittest\n\nclass T(unittest.TestCase):\n    def test_it(self)\n        pass\n',
  });
  try {
    assert.equal(byName(finish(dir), 'python test')?.status, 'fail');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a Python run that collects no tests is never a pass, on any Python version', async () => {
  const { noTestsCollected } = (await import(pathToFileURL(path.join(root, 'dist', 'src', 'core', 'ecosystems.js')).href)) as {
    noTestsCollected: (name: string, code: number | null, log?: string) => boolean;
  };
  // Python before 3.12: unittest exits 0 after running nothing.
  assert.equal(noTestsCollected('python test', 0, '\n----------------------------------------------------------------------\nRan 0 tests in 0.000s\n\nOK\n'), true);
  assert.equal(noTestsCollected('python test (api)', 5), true);
  assert.equal(noTestsCollected('python test', 0, 'Ran 3 tests in 0.01s\n\nOK\n'), false);
  assert.equal(noTestsCollected('test', 5), false);
});

test('only dependency declarations count, not names, descriptions or comments', async () => {
  const { declaredDependencies } = (await import(pathToFileURL(path.join(root, 'dist', 'src', 'core', 'ecosystems.js')).href)) as {
    declaredDependencies: (dir: string) => Set<string>;
  };
  const dir = project({
    'pyproject.toml': [
      '[project]', 'name = "flask-helper"', 'description = "Thin wrapper around the requests API"',
      'dependencies = [', '  "httpx>=0.27",', '  "pydantic[email]~=2.0",', ']', '',
      '[project.optional-dependencies]', 'dev = ["pytest>=8"]', '',
      '[tool.poetry.group.test.dependencies]', 'hypothesis = "^6"', '',
      '[tool.ruff]', 'line-length = 100',
    ].join('\n'),
    'requirements/base.txt': '# django is pinned below\nDjango==5.1\n-r other.txt\n',
    'requirements-dev.txt': 'black\n',
    'setup.cfg': '[metadata]\nname = demo\n\n[options]\ninstall_requires =\n    click>=8\n    rich\npackages = find:\n',
  });
  try {
    const declared = declaredDependencies(dir);
    for (const name of ['httpx', 'pydantic', 'pytest', 'hypothesis', 'django', 'black', 'click', 'rich']) assert.ok(declared.has(name), name);
    for (const name of ['requests', 'flask-helper', 'flask', 'line-length', 'api', 'packages']) assert.ok(!declared.has(name), name);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
