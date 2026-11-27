import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createLedgerApp } from '../../src/app.js';

const STATEMENT = readFileSync(
  fileURLToPath(new URL('../../data/statement-2026-10.jsonl', import.meta.url)),
  'utf8',
);

function loaded() {
  const app = createLedgerApp();
  app.importStatement(STATEMENT);
  return app;
}

function csvIds(csv) {
  return csv.split('\r\n').slice(1).filter(Boolean).map((line) => line.split(',')[0]);
}

function allIds(app) {
  return app.store.all().map((r) => r.id);
}

function walkApi(app, query) {
  const seen = [];
  let cursor;
  for (let guard = 0; guard < 1000; guard++) {
    const page = app.list({ ...query, cursor });
    assert.ok(page.data.length <= Number(query.limit), 'page larger than limit');
    seen.push(...page.data);
    if (page.next == null) return seen;
    assert.ok(page.data.length > 0, 'non-final page must not be empty');
    cursor = page.next;
  }
  throw new Error('pagination did not terminate');
}

test('reported: the October export contains all 237 statement lines exactly once', () => {
  const app = loaded();
  assert.equal(app.store.count(), 237);
  const ids = csvIds(app.exportCsv());
  assert.equal(ids.length, 237);
  assert.equal(new Set(ids).size, 237);
  for (const id of ['tx-103', 'tx-212', 'tx-51']) assert.ok(ids.includes(id), `${id} missing from export`);
});

test('export keeps booking order and statement order inside a batch, for any page size', () => {
  const app = loaded();
  const statementOrder = allIds(app); // the statement is chronological
  for (const pageSize of [1, 3, 7, 50, 64]) {
    assert.deepEqual(csvIds(app.exportCsv({ pageSize })), statementOrder, `pageSize ${pageSize}`);
  }
});

test('same root cause: the transactions API skips nothing, newest first', () => {
  const app = loaded();
  for (const limit of ['7', '25', '50']) {
    const seen = walkApi(app, { limit });
    const ids = seen.map((t) => t.id);
    assert.equal(ids.length, 237, `limit ${limit}`);
    assert.equal(new Set(ids).size, 237, `limit ${limit}: duplicates`);
    for (let i = 1; i < seen.length; i++) {
      assert.ok(seen[i - 1].bookedAt >= seen[i].bookedAt, `limit ${limit}: not newest-first at ${i}`);
    }
  }
});

test('same root cause: ascending API and per-account paging see every row once', () => {
  const app = loaded();
  const asc = walkApi(app, { limit: '6', order: 'asc' }).map((t) => t.id);
  assert.deepEqual(asc, allIds(app));
  for (const account of ['CH-OPS', 'CH-PAYROLL', 'CH-TAX']) {
    const expected = app.store.all().filter((r) => r.accountId === account).map((r) => r.id);
    const got = walkApi(app, { limit: '4', account }).map((t) => t.id);
    assert.deepEqual([...got].sort(), [...expected].sort(), account);
    assert.equal(got.length, expected.length, `${account}: duplicates`);
  }
});

test('same root cause: nightly reconciliation balances match the statement', () => {
  const app = loaded();
  const expected = {};
  for (const r of app.store.all()) expected[r.accountId] = (expected[r.accountId] ?? 0) + r.amountCents;
  assert.deepEqual(app.reconcile(), { rows: 237, balances: expected });
  assert.deepEqual(app.reconcile({ pageSize: 5 }), { rows: 237, balances: expected });
});

test('guard: a cursor token saved by a client before the upgrade still resumes', () => {
  const app = loaded();
  const t = Date.parse('2026-10-15T06:00:00Z') / 1000;
  assert.ok(app.store.all().some((r) => r.bookedAt === t), 'fixture: a batch exists at that time');
  const legacy = Buffer.from(JSON.stringify({ t })).toString('base64url');

  const page = app.list({ limit: '10', cursor: legacy });
  assert.equal(page.data.length, 10);
  for (const tx of page.data) assert.ok(Date.parse(tx.bookedAt) / 1000 < t, 'legacy desc token resumes before t');
  assert.equal(Date.parse(page.data[0].bookedAt) / 1000, Math.max(...app.store.all().map((r) => r.bookedAt).filter((b) => b < t)));

  const asc = app.list({ limit: '10', order: 'asc', cursor: legacy });
  for (const tx of asc.data) assert.ok(Date.parse(tx.bookedAt) / 1000 > t, 'legacy asc token resumes after t');
});

test('guard: tokens from the current release round-trip and bad tokens are still rejected', () => {
  const app = loaded();
  const p1 = app.list({ limit: '5' });
  const again = app.list({ limit: '5', cursor: p1.next });
  const twice = app.list({ limit: '5', cursor: p1.next });
  assert.deepEqual(again, twice);
  assert.throws(() => app.list({ cursor: 'garbage!!' }), { name: 'CursorError' });
  assert.throws(() => app.list({ cursor: Buffer.from('{"x":1}').toString('base64url') }), { name: 'CursorError' });
  const last = walkApi(app, { limit: '500' });
  assert.equal(last.length, 237);
});
