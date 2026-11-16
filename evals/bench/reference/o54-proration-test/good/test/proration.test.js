import test from 'node:test';
import assert from 'node:assert/strict';
import { prorate } from '../src/billing/proration.js';

// SUP-1182: Northwind upgraded on 28 December in a 20 Dec - 20 Jan period and was credited instead of charged.
test('an upgrade in a period that crosses New Year is charged for the days left', () => {
  const p = prorate({ oldPriceCents: 2900, newPriceCents: 7900, periodStart: '2025-12-20', periodEnd: '2026-01-20', changeDay: '2025-12-28' });
  assert.deepEqual(p, { daysLeft: 23, periodDays: 31, credit: 2152, charge: 5861, net: 3709 });
});

test('a change in January of the same period counts the days left in January', () => {
  const p = prorate({ oldPriceCents: 2900, newPriceCents: 7900, periodStart: '2025-12-20', periodEnd: '2026-01-20', changeDay: '2026-01-05' });
  assert.equal(p.daysLeft, 15);
});
