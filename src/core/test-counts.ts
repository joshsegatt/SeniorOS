/**
 * Reads how many tests a test run executed from its output. A test command that exits 0 after running nothing looks
 * exactly like a passing suite; the count tells them apart.
 *
 * Every summary in the output counts, from every runner below: a script may run several (npm workspaces, `node --test
 * && vitest run`), and one run with no tests must not hide another that ran some. Returns the total that ran (passed or
 * failed; skipped tests did not run), or null when no summary is recognised. Null never changes a verdict: only an
 * explicit zero does.
 */
export function testsRan(log: string): number | null {
  const text = log.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
  const lines = text.split('\n');
  let found = false;
  let total = 0;
  const add = (n: number) => {
    found = true;
    total += Math.max(0, n);
  };
  const count = (line: string, re: RegExp) => Number(re.exec(line)?.[1] ?? 0);

  for (const line of lines) {
    // node:test, spec reporter (`ℹ tests 3`) or TAP (`# tests 3`); its skipped and todo lines follow and are subtracted.
    let m = /^[ℹ#] tests (\d+)\s*$/.exec(line);
    if (m) add(Number(m[1]));
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

    // unittest (`Ran 4 tests in 0.001s`).
    m = /^Ran (\d+) tests? in /.exec(line);
    if (m) add(Number(m[1]));

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
