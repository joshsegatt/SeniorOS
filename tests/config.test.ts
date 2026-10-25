import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ConfigError, globToRegExp, loadConfig, parseConfig } from '../src/core/config.js';
import { assessRisk } from '../src/core/risk-engine.js';
import type { ProofReport } from '../src/types.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/index.js');

async function projectWithConfig(config: unknown): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-config-'));
  await mkdir(path.join(root, '.senior'), { recursive: true });
  await writeFile(path.join(root, '.senior', 'config.json'), typeof config === 'string' ? config : JSON.stringify(config));
  return root;
}

test('a missing config file is not an error', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-noconfig-'));
  assert.equal(await loadConfig(root), null);
});

test('a full valid config parses', () => {
  const config = parseConfig({
    schemaVersion: 1,
    proof: { checks: [{ name: 'test', command: 'pytest -q' }] },
    risk: { ignore: ['docs/**'], rules: [{ code: 'billing', points: 4, reason: 'Billing changed.', pattern: '^src/billing/' }] }
  });
  assert.equal(config.proof?.checks[0]?.command, 'pytest -q');
  assert.equal(config.risk?.rules[0]?.points, 4);
});

test('typos and invalid values are rejected with the exact location', () => {
  const cases: Array<[unknown, RegExp]> = [
    [{ schemaVersion: 2 }, /schemaVersion must be 1/],
    [{ schemaVersion: 1, proff: {} }, /unknown key "proff"/],
    [{ schemaVersion: 1, proof: { checks: [] } }, /proof\.checks must be a non-empty array/],
    [{ schemaVersion: 1, proof: { checks: [{ name: 'a', command: 'x' }, { name: 'a', command: 'y' }] } }, /proof\.checks\[1\]\.name "a" is duplicated/],
    [{ schemaVersion: 1, proof: { checks: [{ name: 'a', cmd: 'x' }] } }, /proof\.checks\[0\]: unknown key "cmd"/],
    [{ schemaVersion: 1, risk: { rules: [{ code: 'x', points: 11, reason: 'r', pattern: 'a' }] } }, /points must be an integer from 1 to 10/],
    [{ schemaVersion: 1, risk: { rules: [{ code: 'x', points: 2, reason: 'r', pattern: '(' }] } }, /pattern is not a valid regular expression/],
    [{ schemaVersion: 1, risk: { rules: [{ code: 'Bad Code', points: 2, reason: 'r', pattern: 'a' }] } }, /code must use lowercase/]
  ];
  for (const [value, message] of cases) {
    assert.throws(() => parseConfig(value), (error: unknown) => error instanceof ConfigError && message.test(error.message), String(message));
  }
});

test('invalid JSON names the file', async () => {
  const root = await projectWithConfig('{ "schemaVersion": 1, }');
  await assert.rejects(loadConfig(root), /\.senior\/config\.json is not valid JSON/);
});

test('globToRegExp supports *, ** and ?', () => {
  assert.ok(globToRegExp('docs/**').test('docs/a/b.md'));
  assert.ok(globToRegExp('**/*.md').test('README.md'));
  assert.ok(globToRegExp('**/*.md').test('a/b/c.md'));
  assert.ok(!globToRegExp('*.md').test('a/b.md'));
  assert.ok(globToRegExp('file?.txt').test('file1.txt'));
  assert.ok(!globToRegExp('src/*.ts').test('src/x.tsx'));
});

test('project rules raise risk and ignored paths stop counting', () => {
  const report = assessRisk(
    [
      { status: 'M', path: 'src/billing/charge.ts' },
      { status: 'M', path: 'docs/api/routes.md' }
    ],
    {
      extraRules: [{ code: 'billing', points: 4, reason: 'Billing changed.', pattern: '^src/billing/' }],
      ignore: ['docs/**']
    }
  );
  assert.deepEqual(report.signals.map((signal) => signal.code), ['billing']);
  assert.deepEqual(report.ignored, ['docs/api/routes.md']);
  assert.equal(report.level, 'medium');
});

test('ignore never hides the secrets rule', () => {
  const report = assessRisk([{ status: 'M', path: '.env.production' }], { ignore: ['.env*'] });
  assert.ok(report.signals.some((signal) => signal.code === 'secrets'));
  assert.equal(report.level, 'high');
});

test('finish runs configured checks for non-Node projects', async () => {
  const root = await projectWithConfig({
    schemaVersion: 1,
    proof: {
      checks: [
        { name: 'lint', command: 'node -e "console.log(\'lint ok\')"' },
        { name: 'test', command: 'node -e "process.exit(4)"' },
        { name: 'build', command: 'node -e "console.log(\'never\')"' }
      ]
    }
  });
  const run = spawnSync(process.execPath, [CLI, 'finish', '--json'], { cwd: root, encoding: 'utf8' });
  const report = JSON.parse(run.stdout) as ProofReport;

  assert.equal(report.source, 'config');
  assert.equal(report.totalChecks, 3);
  assert.deepEqual(report.checks.map((check) => [check.name, check.status]), [['lint', 'pass'], ['test', 'fail'], ['build', 'skip']]);
  assert.equal(report.checks[1]?.exitCode, 4);
  assert.equal(run.status, 1);
});

test('an invalid config makes the CLI fail loudly instead of ignoring it', async () => {
  const root = await projectWithConfig({ schemaVersion: 1, proof: { checks: [{ name: 'test', commnd: 'x' }] } });
  const run = spawnSync(process.execPath, [CLI, 'finish'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /unknown key "commnd"/);

  const doctor = spawnSync(process.execPath, [CLI, 'doctor'], { cwd: root, encoding: 'utf8' });
  assert.match(doctor.stdout, /Config: invalid: .*unknown key "commnd"/);
});
