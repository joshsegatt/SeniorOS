import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appWith } from './helpers.js';

test('balances per account', () => {
  const app = appWith([
    [0, 'CH-OPS', '-10.00', 'a'],
    [60, 'CH-OPS', '2.50', 'b'],
    [120, 'CH-TAX', '-100.00', 'c'],
  ]);
  assert.deepEqual(app.reconcile({ pageSize: 2 }), { rows: 3, balances: { 'CH-OPS': -750, 'CH-TAX': -10000 } });
});

test('empty ledger', () => {
  assert.deepEqual(appWith([]).reconcile(), { rows: 0, balances: {} });
});
