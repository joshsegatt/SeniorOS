import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appWith, csvIds } from './helpers.js';

test('export lists every transaction in booking order across pages', () => {
  const rows = Array.from({ length: 12 }, (_, i) => [i * 60, 'CH-OPS', `-${i + 1}.00`, `item ${i + 1}`]);
  const app = appWith(rows);
  const ids = csvIds(app.exportCsv({ pageSize: 5 }));
  assert.deepEqual(ids, rows.map((_, i) => `tx-${i + 1}`));
});

test('same-time rows keep statement order', () => {
  // tx-1..tx-7 are booked in one batch; tx-8..tx-12 in a later one.
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => [0, 'CH-OPS', '-1.00', `a${i}`]),
    ...Array.from({ length: 5 }, (_, i) => [3600, 'CH-OPS', '-1.00', `b${i}`]),
  ];
  const ids = csvIds(appWith(rows).exportCsv());
  assert.deepEqual(ids, ['tx-1', 'tx-2', 'tx-3', 'tx-4', 'tx-5', 'tx-6', 'tx-7', 'tx-8', 'tx-9', 'tx-10', 'tx-11', 'tx-12']);
});

test('export row format', () => {
  const app = appWith([[0, 'CH-OPS', '-12.40', 'Lunch, team "offsite"']]);
  assert.equal(
    app.exportCsv(),
    'id,booked_at,account,amount,memo\r\ntx-1,2026-10-01T06:00:00Z,CH-OPS,-12.40,"Lunch, team ""offsite"""\r\n',
  );
});

test('export can be limited to one account', () => {
  const app = appWith([
    [0, 'CH-OPS', '-1.00', 'a'],
    [60, 'CH-TAX', '-2.00', 'b'],
    [120, 'CH-OPS', '-3.00', 'c'],
  ]);
  assert.deepEqual(csvIds(app.exportCsv({ accountId: 'CH-OPS', pageSize: 1 })), ['tx-1', 'tx-3']);
});
