import test from 'node:test';
import assert from 'node:assert/strict';
import { importCustomers } from '../src/imports/customers.js';
import { ordersCsv } from '../src/exports/orders.js';
import { centsToDecimal } from '../src/lib/cents.js';

test('customer upload normalizes emails and skips rows without one', () => {
  const text = 'email,name,newsletter\nAda@Example.test,Ada,yes\nnot-an-email,Bob,no\nCy@example.test, Cy ,no\n';
  assert.deepEqual(importCustomers(text), {
    customers: [
      { email: 'ada@example.test', name: 'Ada', newsletter: true },
      { email: 'cy@example.test', name: 'Cy', newsletter: false },
    ],
    skipped: 1,
  });
});

test('orders export has one line per order', () => {
  const csv = ordersCsv([
    { id: 'o-1042', placedAt: '2026-10-02T09:14:52Z', customerEmail: 'ada@example.test', totalCents: 2490 },
    { id: 'o-1043', placedAt: '2026-10-02T11:00:00Z', customerEmail: 'bob@example.test', totalCents: 1250, note: 'Leave at the door, please' },
  ]);
  assert.equal(csv, 'id,date,customer,total,note\no-1042,2026-10-02,ada@example.test,24.90,\no-1043,2026-10-02,bob@example.test,12.50,"Leave at the door, please"\n');
});

test('cents to decimal strings', () => {
  assert.equal(centsToDecimal(2490), '24.90');
  assert.equal(centsToDecimal(-1205, { comma: true }), '-12,05');
});
