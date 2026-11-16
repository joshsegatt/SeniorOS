import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prorate } from '../../src/billing/proration.js';
import { changePlan, subscribe } from '../../src/billing/subscriptions.js';

// This file runs from test/__hidden__/ in a copy of the finished repository; base/ next to it holds the source
// files as they were before the fix.
const root = fileURLToPath(new URL('../../', import.meta.url));
const base = fileURLToPath(new URL('./base/', import.meta.url));

/** A copy of the repository without the hidden tests (the project's glob would pick them up). */
function copyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'o54-'));
  cpSync(root, dir, {
    recursive: true,
    filter: (src) => !/^(\.git|node_modules|test\/__hidden__)(\/|$)/.test(relative(root, src).split(sep).join('/')),
  });
  return dir;
}

/** `npm test` as the team runs it, standalone (a parent `node --test` would turn it into a reporting child). */
function npmTest(cwd) {
  const { NODE_TEST_CONTEXT: _parent, ...env } = process.env;
  const r = spawnSync('npm', ['test'], { cwd, env, shell: true, encoding: 'utf8', timeout: 60_000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const counts = out.split(/\r?\n/).map((l) => l.replace(/^(ℹ|#)\s*/, '')).filter((l) => /^(tests|pass|fail) \d+$/.test(l)).join(', ');
  return { ok: r.status === 0, detail: counts || `exit ${r.status}` };
}

test('the reported case: an upgrade in a period that crosses New Year is charged, not credited', () => {
  const p = prorate({ oldPriceCents: 2900, newPriceCents: 7900, periodStart: '2025-12-20', periodEnd: '2026-01-20', changeDay: '2025-12-28' });
  assert.deepEqual(p, { daysLeft: 23, periodDays: 31, credit: 2152, charge: 5861, net: 3709 });
  const { lines } = changePlan(subscribe('sub-311', 'Northwind Traders', 'team', '2025-12-20'), 'business', '2025-12-28');
  assert.deepEqual(lines, [
    { description: 'Unused time on Team (23 of 31 days)', amountCents: -2152 },
    { description: 'Remaining time on Business (23 of 31 days)', amountCents: 5861 },
  ]);
});

test('days left are right for changes in either month of the period, and on its first day', () => {
  const at = (periodStart, periodEnd, changeDay) => prorate({ oldPriceCents: 900, newPriceCents: 2900, periodStart, periodEnd, changeDay }).daysLeft;
  assert.equal(at('2025-12-20', '2026-01-20', '2026-01-05'), 15);
  assert.equal(at('2025-12-31', '2026-01-31', '2025-12-31'), 31);
  assert.equal(at('2026-03-01', '2026-04-01', '2026-03-17'), 15);
  assert.equal(at('2026-02-20', '2026-03-20', '2026-03-19'), 1);
});

test('npm test is green with the fix', () => {
  const dir = copyRepo();
  try {
    const r = npmTest(dir);
    assert.ok(r.ok, `npm test fails: ${r.detail}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a regression test that npm test runs fails once the fix is reverted', () => {
  const dir = copyRepo();
  try {
    cpSync(join(base, 'src'), join(dir, 'src'), { recursive: true, force: true });
    const r = npmTest(dir);
    assert.ok(!r.ok, `npm test stays green with the original source (${r.detail}): no test it runs covers the bug`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
