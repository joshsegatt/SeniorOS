import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appWith } from './helpers.js';

const rows = Array.from({ length: 9 }, (_, i) => [i * 600, i % 3 === 0 ? 'CH-TAX' : 'CH-OPS', `-${i + 1}.00`, `m${i + 1}`]);

test('newest first by default, with a next token until the last page', () => {
  const app = appWith(rows);
  const p1 = app.list({ limit: '4' });
  assert.deepEqual(p1.data.map((t) => t.id), ['tx-9', 'tx-8', 'tx-7', 'tx-6']);
  assert.equal(typeof p1.next, 'string');
  const p2 = app.list({ limit: '4', cursor: p1.next });
  assert.deepEqual(p2.data.map((t) => t.id), ['tx-5', 'tx-4', 'tx-3', 'tx-2']);
  const p3 = app.list({ limit: '4', cursor: p2.next });
  assert.deepEqual(p3.data.map((t) => t.id), ['tx-1']);
  assert.equal(p3.next, null);
});

test('ascending order and account filter', () => {
  const app = appWith(rows);
  const p1 = app.list({ limit: 2, order: 'asc', account: 'CH-TAX' });
  assert.deepEqual(p1.data.map((t) => t.id), ['tx-1', 'tx-4']);
  const p2 = app.list({ limit: 2, order: 'asc', account: 'CH-TAX', cursor: p1.next });
  assert.deepEqual(p2.data.map((t) => t.id), ['tx-7']);
  assert.equal(p2.next, null);
});

test('response shape', () => {
  const app = appWith(rows);
  assert.deepEqual(app.list({ limit: 1 }).data[0], {
    id: 'tx-9',
    bookedAt: '2026-10-01T07:20:00Z',
    account: 'CH-OPS',
    amount: '-9.00',
    memo: 'm9',
  });
});

test('bad input is rejected', () => {
  const app = appWith(rows);
  assert.throws(() => app.list({ limit: 0 }), RangeError);
  assert.throws(() => app.list({ cursor: 'not-a-cursor' }), { name: 'CursorError' });
});
