import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * A standard check for a Python, Go or Rust project. `command` is null when the check cannot or need not run (the tool
 * is not installed, nothing changed in the project); it is then reported as skipped with `skipReason`, never as passed.
 */
export interface EcosystemCheck {
  name: string;
  command: string | null;
  file?: string;
  args?: string[];
  /** The project folder the check runs in. */
  cwd?: string;
  skipReason?: string;
  /** Set on Python test checks: lets a failure caused by an uninstalled, declared dependency be told apart. */
  python?: { dir: string; interpreter: string };
  /** Runs a Python tool: its caches go to a temporary folder, not the repository (see proof-engine.ts). */
  pythonTool?: true;
}

type Kind = 'python' | 'go' | 'rust';

interface Project {
  dir: string;
  kinds: Kind[];
}

const PYTHON_MANIFESTS = ['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt'];
/**
 * Files that mark a Python, Go or Rust project. The finish gate (adapters/antigravity/hooks/lib.mjs) runs without this
 * module, so it keeps its own copies of these three values; a test keeps them equal.
 */
export const PROJECT_MANIFESTS = [...PYTHON_MANIFESTS, 'go.mod', 'Cargo.toml'];
// Folders that never hold a project of the repository's own: dependencies, environments, build output.
export const IGNORED_DIRS = /^(\..*|node_modules|vendor|third_party|target|build|dist|out|venv|env|__pycache__|site-packages)$/;
export const MAX_DEPTH = 2;

const read = (file: string): string => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};

function kindsAt(dir: string): Kind[] {
  const has = (file: string) => existsSync(path.join(dir, file));
  const kinds: Kind[] = [];
  if (PYTHON_MANIFESTS.some(has)) kinds.push('python');
  if (has('go.mod')) kinds.push('go');
  if (has('Cargo.toml')) kinds.push('rust');
  return kinds;
}

/**
 * Python, Go and Rust projects at the root and up to two folder levels below it (`backend/`, `services/api/`).
 * Members of a Cargo workspace are covered by the workspace's own `cargo test` and are not listed again.
 */
export function discoverProjects(root: string): Project[] {
  const projects: Project[] = [];
  const walk = (dir: string, depth: number, inCargoWorkspace: boolean) => {
    let kinds = kindsAt(dir);
    if (inCargoWorkspace) kinds = kinds.filter((k) => k !== 'rust');
    if (kinds.length) projects.push({ dir, kinds });
    if (depth >= MAX_DEPTH) return;
    const workspace = inCargoWorkspace || /^\[workspace\]/m.test(read(path.join(dir, 'Cargo.toml')));
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !IGNORED_DIRS.test(entry.name)) walk(path.join(dir, entry.name), depth + 1, workspace);
    }
  };
  walk(root, 0, false);
  return projects;
}

/** True when `file` runs and exits 0 with `args` (a quick availability probe). */
function runs(file: string, args: string[], cwd: string): boolean {
  const r = spawnSync(file, args, { cwd, stdio: 'ignore', timeout: 20_000, windowsHide: true });
  return !r.error && r.status === 0;
}

function output(file: string, args: string[], cwd: string): string {
  const r = spawnSync(file, args, { cwd, encoding: 'utf8', timeout: 20_000, windowsHide: true });
  return !r.error && r.status === 0 ? r.stdout.trim() : '';
}

/** Display form of a command: quoted when a path has spaces. */
function display(file: string, args: string[]): string {
  return [file, ...args].map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(' ');
}

/**
 * The project's interpreter: a virtual environment in the folder, then Poetry's or Pipenv's environment, then the
 * interpreter on PATH. Asking Poetry and Pipenv for the path never creates or installs anything.
 */
function pythonFor(dir: string): string | null {
  for (const venv of ['.venv', 'venv', 'env']) {
    const candidate = process.platform === 'win32'
      ? path.join(dir, venv, 'Scripts', 'python.exe')
      : path.join(dir, venv, 'bin', 'python');
    if (existsSync(candidate)) return candidate;
  }
  if (existsSync(path.join(dir, 'poetry.lock'))) {
    const python = output('poetry', ['env', 'info', '--executable'], dir);
    if (python && existsSync(python)) return python;
  }
  if (existsSync(path.join(dir, 'Pipfile'))) {
    const python = output('pipenv', ['--py'], dir);
    if (python && existsSync(python)) return python;
  }
  for (const name of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    if (runs(name, ['--version'], dir)) return name;
  }
  return null;
}

/** True when the folder has Python test files outside environments and dependencies. */
function hasPythonTests(dir: string, depth = 0): boolean {
  if (depth > 4) return false;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isFile() && /^(test_.*|.*_test)\.py$/.test(entry.name)) return true;
    if (entry.isDirectory() && !IGNORED_DIRS.test(entry.name) && hasPythonTests(path.join(dir, entry.name), depth + 1)) return true;
  }
  return false;
}

function pythonChecks(dir: string, label: string, probe: boolean): EcosystemCheck[] {
  const pyproject = read(path.join(dir, 'pyproject.toml'));
  const mypyIni = read(path.join(dir, 'mypy.ini')) || read(path.join(dir, '.mypy.ini'));
  const configured = (tool: string, files: string[]) =>
    new RegExp(`^\\[tool\\.${tool}[\\].]`, 'm').test(pyproject) || files.some((f) => existsSync(path.join(dir, f)));
  const name = (n: string) => `python ${n}${label}`;
  if (!probe) {
    // Names only: a project that will not run needs no interpreter or tool lookup.
    return [
      ...(configured('mypy', ['mypy.ini', '.mypy.ini']) ? [{ name: name('typecheck'), command: null }] : []),
      ...(configured('ruff', ['ruff.toml', '.ruff.toml']) ? [{ name: name('lint'), command: null }] : []),
      { name: name('test'), command: null },
    ];
  }
  const python = pythonFor(dir);
  const run = (n: string, args: string[]): EcosystemCheck => ({ name: name(n), command: display(python ?? 'python', args), file: python ?? 'python', args, cwd: dir, pythonTool: true });
  const skip = (n: string, why: string): EcosystemCheck => ({ name: name(n), command: null, skipReason: why });
  const plan: EcosystemCheck[] = [];

  if (configured('mypy', ['mypy.ini', '.mypy.ini'])) {
    // Without a `files` setting, `mypy .` would also read the virtual environment.
    const hasFiles = /^\s*files\s*=/m.test(mypyIni) || /\[tool\.mypy\][^[]*^\s*files\s*=/m.test(pyproject);
    const args = hasFiles ? ['-m', 'mypy'] : ['-m', 'mypy', '.', '--exclude', '(^|/)(\\.?venv|env|build|dist)/'];
    plan.push(python && runs(python, ['-m', 'mypy', '--version'], dir) ? run('typecheck', args) : skip('typecheck', 'mypy is configured but not installed'));
  }
  if (configured('ruff', ['ruff.toml', '.ruff.toml'])) {
    plan.push(python && runs(python, ['-m', 'ruff', '--version'], dir) ? run('lint', ['-m', 'ruff', 'check', '.']) : skip('lint', 'ruff is configured but not installed'));
  }

  const pytestConfigured = configured('pytest', ['pytest.ini', 'conftest.py']) || /^\[pytest\]/m.test(read(path.join(dir, 'tox.ini')));
  let test: EcosystemCheck;
  if (!python) test = skip('test', 'python not found');
  else if (runs(python, ['-c', 'import pytest'], dir)) test = run('test', ['-m', 'pytest', '-q', '--continue-on-collection-errors', '-p', 'no:cacheprovider']);
  else if (pytestConfigured) test = skip('test', 'pytest is configured but not installed');
  else if (hasPythonTests(dir)) test = run('test', ['-m', 'unittest', 'discover']);
  else test = skip('test', 'no Python tests found');
  if (test.command !== null && python) test.python = { dir, interpreter: python };
  plan.push(test);
  return plan;
}

function goChecks(dir: string, label: string, probe: boolean): EcosystemCheck[] {
  if (!probe) return ['vet', 'test'].map((n) => ({ name: `go ${n}${label}`, command: null }));
  if (!runs('go', ['version'], dir)) return ['vet', 'test'].map((n) => ({ name: `go ${n}${label}`, command: null, skipReason: 'go not found' }));
  return [
    { name: `go vet${label}`, command: 'go vet ./...', file: 'go', args: ['vet', './...'], cwd: dir },
    { name: `go test${label}`, command: 'go test ./...', file: 'go', args: ['test', './...'], cwd: dir },
  ];
}

function rustChecks(dir: string, label: string, probe: boolean): EcosystemCheck[] {
  if (!probe) return [{ name: `rust test${label}`, command: null }];
  if (!runs('cargo', ['--version'], dir)) return [{ name: `rust test${label}`, command: null, skipReason: 'cargo not found' }];
  // --workspace: a root that is also a package, or sets default-members, would otherwise leave members untested.
  return [{ name: `rust test${label}`, command: 'cargo test --workspace', file: 'cargo', args: ['test', '--workspace'], cwd: dir }];
}

const relative = (root: string, dir: string) => path.relative(root, dir).split(path.sep).join('/');

/**
 * Standard checks for the Python, Go and Rust projects in the repository.
 * @param changed absolute paths of the changed files; projects that own none of them are skipped. Null runs all.
 */
export function ecosystemPlan(root: string, changed: string[] | null = null): EcosystemCheck[] {
  const projects = discoverProjects(root);
  // Each changed file belongs to the deepest project folder that contains it.
  const owners = new Set<string>();
  // Git and the working folder may spell one path differently: Windows short names (`JOSHSE~1`), symlinks, and case
  // on Windows. Compare real paths.
  const real = (p: string) => {
    try {
      return realpathSync.native(p);
    } catch {
      return path.resolve(p);
    }
  };
  const key = (p: string) => (process.platform === 'win32' ? real(p).toLowerCase() : real(p));
  if (changed) {
    for (const changedFile of changed) {
      const file = key(changedFile);
      const owner = projects
        .filter((p) => file === key(p.dir) || file.startsWith(key(p.dir) + path.sep))
        .sort((a, b) => b.dir.length - a.dir.length)[0];
      if (owner) owners.add(owner.dir);
    }
  }
  const plan: EcosystemCheck[] = [];
  for (const project of projects) {
    const rel = relative(root, project.dir);
    const label = rel ? ` (${rel})` : '';
    const touched = !changed || owners.has(project.dir);
    const checks = [
      ...(project.kinds.includes('python') ? pythonChecks(project.dir, label, touched) : []),
      ...(project.kinds.includes('go') ? goChecks(project.dir, label, touched) : []),
      ...(project.kinds.includes('rust') ? rustChecks(project.dir, label, touched) : []),
    ];
    if (touched) plan.push(...checks);
    else for (const c of checks) plan.push({ name: c.name, command: null, skipReason: 'no changes in this project (--all runs it)' });
  }
  return plan;
}

/**
 * True when a Python test run collected nothing: pytest and unittest on Python 3.12+ exit 5, while unittest on older
 * versions exits 0 after "Ran 0 tests", which must not read as a pass.
 */
export function noTestsCollected(name: string, exitCode: number | null, log = ''): boolean {
  if (!name.startsWith('python test')) return false;
  return exitCode === 5 || (exitCode === 0 && /^Ran 0 tests\b/m.test(log));
}

// Import names that differ from the distribution name people declare.
const DISTRIBUTION_OF: Record<string, string> = {
  yaml: 'pyyaml', PIL: 'pillow', sklearn: 'scikit-learn', cv2: 'opencv-python', bs4: 'beautifulsoup4',
  dateutil: 'python-dateutil', jwt: 'pyjwt', dotenv: 'python-dotenv', google: 'protobuf', attr: 'attrs',
  magic: 'python-magic', serial: 'pyserial', Crypto: 'pycryptodome', OpenSSL: 'pyopenssl',
};

const normalize = (name: string) => name.toLowerCase().replace(/[-_.]+/g, '-');

/** The distribution name a requirement string starts with (`requests[socks]>=2` → `requests`). */
const requirementName = (spec: string) => /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(spec)?.[1] ?? '';

/**
 * The text of the list that opens after `key = [` (or `key=[`), up to its closing bracket outside quotes, so extras
 * such as `"pydantic[email]"` do not end it early. Empty when the key is absent.
 */
function listAfter(text: string, key: RegExp): string {
  const open = key.exec(text);
  if (!open) return '';
  let quote = '';
  for (let i = open.index + open[0].length; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ']') return text.slice(open.index + open[0].length, i);
  }
  return '';
}

/** Quoted strings in a TOML or Python fragment. */
const quoted = (text: string) => [...text.matchAll(/["']([^"'\n]+)["']/g)].map((m) => m[1] ?? '');

/** The body of each TOML table whose header matches, up to the next table header. */
function tables(toml: string, header: RegExp): string[] {
  const bodies: string[] = [];
  const parts = toml.split(/^(?=\[)/m);
  for (const part of parts) {
    const head = /^\[([^\]]+)\]/.exec(part)?.[1]?.trim();
    if (head && header.test(head)) bodies.push(part.slice(part.indexOf(']') + 1));
  }
  return bodies;
}

/** Keys of `name = ...` lines (Poetry and Pipenv dependency tables). */
const keys = (body: string) => [...body.matchAll(/^\s*["']?([A-Za-z0-9][A-Za-z0-9._-]*)["']?\s*=/gm)].map((m) => m[1] ?? '');

/**
 * The distributions a Python project declares, read only from dependency declarations: `requirements*.txt` and
 * `requirements/*.txt`, `[project]` dependencies and optional dependencies, `[dependency-groups]`, Poetry dependency
 * tables, Pipfile packages, and `install_requires` in setup.cfg and setup.py. Names, descriptions and comments do not
 * count.
 */
export function declaredDependencies(dir: string): Set<string> {
  const names: string[] = [];
  const requirementFiles: string[] = [];
  try {
    for (const f of readdirSync(dir)) if (/^requirements.*\.(txt|in)$/i.test(f)) requirementFiles.push(path.join(dir, f));
  } catch {}
  try {
    for (const f of readdirSync(path.join(dir, 'requirements'))) if (/\.(txt|in)$/i.test(f)) requirementFiles.push(path.join(dir, 'requirements', f));
  } catch {}
  for (const file of requirementFiles) {
    for (const line of read(file).split(/\r?\n/)) {
      if (!/^\s*(#|-)/.test(line)) names.push(requirementName(line));
    }
  }

  const pyproject = read(path.join(dir, 'pyproject.toml'));
  for (const body of tables(pyproject, /^project$/)) {
    names.push(...quoted(listAfter(body, /^\s*dependencies\s*=\s*\[/m)).map(requirementName));
  }
  // Inline tables such as `{include-group = "test"}` name other groups, not dependencies.
  for (const body of tables(pyproject, /^(project\.optional-dependencies|dependency-groups)$/)) {
    names.push(...quoted(body.replace(/\{[^}]*\}/g, '')).map(requirementName));
  }
  for (const body of tables(pyproject, /^tool\.poetry(\.group\.[^.]+)?\.(dev-)?dependencies$/)) names.push(...keys(body));

  for (const body of tables(read(path.join(dir, 'Pipfile')), /^(dev-)?packages$/)) names.push(...keys(body));

  const setupCfg = read(path.join(dir, 'setup.cfg'));
  const cfgRequires = /^install_requires\s*=([\s\S]*?)(?=^\S|$(?![\s\S]))/m.exec(setupCfg)?.[1] ?? '';
  names.push(...cfgRequires.split(/\r?\n/).map(requirementName));
  names.push(...quoted(listAfter(read(path.join(dir, 'setup.py')), /install_requires\s*=\s*\[/)).map(requirementName));

  return new Set(names.filter(Boolean).map(normalize));
}

/** Whether the interpreter can find a top-level package (without importing it). */
function installed(python: { dir: string; interpreter: string }, module: string): boolean {
  if (!/^\w+$/.test(module)) return false;
  return runs(python.interpreter, ['-c', `import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('${module}') else 1)`], python.dir);
}

/** Whether `module` is the project's own code rather than a dependency. */
function isLocalModule(dir: string, module: string): boolean {
  return [module, `${module}.py`, path.join('src', module), path.join('src', `${module}.py`)].some((p) => existsSync(path.join(dir, p)));
}

/**
 * Reads a failing Python test run. When it failed only because modules the project declares are not installed in the
 * interpreter used, that is the environment, not the change: returns the reason to skip the check. Any other cause,
 * including a module that is the project's own or that it does not declare, stays a failure (null).
 */
export function environmentFailure(log: string, python: { dir: string; interpreter: string }): string | null {
  const missingNames = [...new Set([...log.matchAll(/No module named '([\w.]+)'/g)].map((m) => m[1] ?? ''))].filter(Boolean);
  if (missingNames.length === 0) return null;
  // `pytest.nonexistent` missing while `pytest` is installed is a broken import in the code, not the environment.
  for (const name of missingNames) {
    const top = name.split('.')[0] ?? name;
    if (name !== top && installed(python, top)) return null;
  }
  const missing = [...new Set(missingNames.map((name) => name.split('.')[0] ?? name))];
  // A test that ran and failed is a failure, whatever else could not be imported.
  const failedTests = Number(/(\d+) failed/.exec(log)?.[1] ?? 0) + Number(/failures=(\d+)/.exec(log)?.[1] ?? 0);
  if (failedTests > 0) return null;
  // So is any other error in the run (a SyntaxError, a TypeError, an import of a name that moved): every error line must
  // be a missing module.
  for (const line of log.matchAll(/^(?:E\s+)?([A-Za-z_][\w.]*(?:Error|Exception))\b(.*)$/gm)) {
    const [, type, rest = ''] = line;
    const missingModule = (type === 'ModuleNotFoundError' || type === 'ImportError') && /No module named|while importing test module|Failed to import test module/.test(rest);
    if (!missingModule) return null;
  }
  const declared = declaredDependencies(python.dir);
  for (const module of missing) {
    if (isLocalModule(python.dir, module)) return null;
    if (!declared.has(normalize(DISTRIBUTION_OF[module] ?? module))) return null;
  }
  return `not verified: declared dependencies not installed for ${python.interpreter} (${missing.join(', ')})`;
}
