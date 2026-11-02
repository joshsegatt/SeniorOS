import { isTestPath } from './regression.js';

/**
 * Reads how many tests a test run executed from its output. A test command that exits 0 after running nothing looks
 * exactly like a passing suite; the count tells them apart.
 *
 * Every summary in the output counts, from every runner below: a script may run several (npm workspaces, `node --test
 * && vitest run`), and one run with no tests must not hide another that ran some. Returns the total that ran (passed or
 * failed; skipped tests did not run), or null when no summary is recognised. Null never changes a verdict: only an
 * explicit zero does.
 */
export function testsRan(log: string, options: TestsRanOptions = {}): number | null {
  const text = log.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
  const lines = text.split('\n');
  let found = false;
  let total = 0;
  const add = (n: number) => {
    found = true;
    total += Math.max(0, n);
  };
  const count = (line: string, re: RegExp) => Number(re.exec(line)?.[1] ?? 0);

  // The lines of the current node:test run, up to its summary (see emptyTestFileEntries).
  let run: string[] = [];

  for (const line of lines) {
    run.push(line);
    // node:test, spec reporter (`ℹ tests 3`) or TAP (`# tests 3`); its skipped and todo lines follow and are subtracted.
    let m = /^[ℹ#] tests (\d+)\s*$/.exec(line);
    if (m) {
      const reported = Number(m[1]);
      const empty = options.isEmptyTestFile ? emptyTestFileEntries(run, options.isEmptyTestFile) : 0;
      add(reported - Math.min(reported, empty));
      run = [];
    }
    m = /^[ℹ#] (?:skip(?:ped)?|todo) (\d+)\s*$/.exec(line);
    if (m) total -= Number(m[1]);

    // Jest (`Tests:       1 skipped, 4 passed, 5 total`).
    m = /^Tests:\s+.*?(\d+) total/.exec(line);
    if (m) add(Number(m[1]) - count(line, /(\d+) skipped/) - count(line, /(\d+) todo/));

    // Vitest (`Tests  1 failed | 6 passed (7)`).
    m = /^\s*Tests\s+(?!Files).*\((\d+)\)\s*$/.exec(line);
    if (m) add(Number(m[1]) - count(line, /(\d+) skipped/) - count(line, /(\d+) todo/));

    // Mocha (`5 passing`, then `1 failing`).
    m = /^\s*(\d+) passing\b/.exec(line);
    if (m) add(Number(m[1]));
    m = /^\s*(\d+) failing\b/.exec(line);
    if (m) total += Number(m[1]);

    // pytest (`3 passed, 1 failed in 0.12s`, `no tests ran in 0.01s`).
    if (/\bno tests ran\b/.test(line)) add(0);
    m = /^=*\s*((?:\d+ (?:passed|failed|errors?|xfailed|xpassed|skipped|deselected|warnings?)(?:, )?)+) in [\d.]+s/.exec(line);
    if (m?.[1]) add(['passed', 'failed', 'xfailed', 'xpassed', 'errors?'].reduce((s, k) => s + count(m?.[1] ?? '', new RegExp(`(\\d+) ${k}\\b`)), 0));

    // unittest (`Ran 4 tests in 0.001s`); the count includes skipped tests, given after it (`OK (skipped=2)`,
    // `FAILED (failures=1, skipped=1)`), so a suite that skipped everything ran nothing.
    m = /^Ran (\d+) tests? in /.exec(line);
    if (m) add(Number(m[1]));
    m = /^(?:OK|FAILED) \(.*\bskipped=(\d+)/.exec(line);
    if (m) total -= Number(m[1]);

    // cargo test: one line per test binary and doc-tests.
    m = /^test result: \w+\. (\d+) passed; (\d+) failed/.exec(line);
    if (m) add(Number(m[1]) + Number(m[2]));
  }

  // Jest and Vitest say so when they find nothing.
  if (/^No tests found/m.test(text) || /No test files found/.test(text)) add(0);

  // go test prints no count without -v. A package that ran tests makes the total unknown; only packages that all had
  // nothing to run make it zero.
  // go test separates its fields with tabs (`ok  \texample.com/demo\t0.01s`); TAP's `ok 1 - name` does not.
  const goLines = lines.filter((l) => /^(ok|FAIL|\?)\s*\t\S+\t/.test(l));
  if (goLines.length > 0) {
    if (!goLines.every((l) => /\[no test files\]|\[no tests to run\]/.test(l))) return null;
    add(0);
  }

  return found ? total : null;
}

export interface TestsRanOptions {
  /**
   * Whether a path, as the test runner printed it (relative to the test command's directory, or absolute), is an
   * existing file with no tests in it. Without it, node:test entries for empty test files still count.
   */
  isEmptyTestFile?: (path: string) => boolean;
}

/**
 * A JavaScript or TypeScript test file by its path: the project's test patterns (`test/`, `*.test.*`, `*.spec.*`…)
 * and the names `node --test` also picks up on its own (`test.js`, `test-*.js`, `*-test.js`).
 */
function looksLikeTestFile(path: string): boolean {
  const p = path.replace(/\\/g, '/');
  if (!/\.[cm]?[jt]sx?$/.test(p) || /(^|\/)node_modules\//.test(p)) return false;
  return isTestPath(p) || /(?:^|\/)(?:test|test-[^/]+|[^/]+-test)\.[cm]?[jt]sx?$/.test(p);
}

/**
 * How many entries of one node:test run (its lines up to the `tests N` summary) are test files with no tests in
 * them. node:test reports such a file as one passing top-level test named after the file: spec
 * `✔ test\a.test.js (38ms)`; TAP `# Subtest: test\\a.test.js` then `ok 1 - test\\a.test.js` (Node 20 prints the
 * absolute path). A file that has tests shows only their names. An entry counts when it is a top-level leaf (not a
 * suite, no subtests) naming a test file that `isEmptyTestFile` confirms is empty; each file once.
 */
function emptyTestFileEntries(lines: string[], isEmptyTestFile: (path: string) => boolean): number {
  const empty = new Set<string>();
  const check = (name: string) => {
    if (looksLikeTestFile(name) && isEmptyTestFile(name)) empty.add(name.replace(/\\/g, '/'));
  };

  // Spec: a suite with children opens with `▶ name` and closes with `✔ name (1ms)` like a test (Node 20, 22, 24).
  const suites = new Set(lines.map((l) => /^▶ (.+?)(?: \([\d.]+m?s\))?\s*$/.exec(l)?.[1]).filter((n): n is string => Boolean(n)));
  for (const line of lines) {
    const name = /^✔ (.+?) \([\d.]+m?s\)\s*$/.exec(line)?.[1];
    if (name && !suites.has(name)) check(name);
  }

  // TAP: `# Subtest: name`, its children indented, then `ok N - name` and a YAML block that may say `type: 'suite'`.
  let subtest: string | null = null;
  let children = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const opened = /^# Subtest: (.+?)\s*$/.exec(line);
    if (opened) {
      subtest = opened[1] ?? null;
      children = false;
      continue;
    }
    if (/^\s+(?:not )?ok \d+/.test(line)) children = true;
    const closed = /^ok \d+ - (.+?)\s*$/.exec(line);
    if (!closed) continue;
    const name = closed[1] ?? '';
    let suite = false;
    for (let j = i + 1; j < Math.min(lines.length, i + 8) && !/^\s+\.\.\.\s*$/.test(lines[j] ?? ''); j++) {
      if (/^\s+type: 'suite'/.test(lines[j] ?? '')) suite = true;
    }
    // TAP escapes backslashes and `#` in names (`test\\a.test.js`, `h\#1`).
    if (name === subtest && !children && !suite) check(name.replace(/\\([\\#])/g, '$1'));
    subtest = null;
  }

  return empty.size;
}
