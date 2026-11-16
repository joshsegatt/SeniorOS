import test from 'node:test';
import assert from 'node:assert/strict';
import { daysLeft, periodDays, prorate } from '../proration.js';

test('days left count the change day', () => {
  assert.equal(daysLeft('2026-03-20', '2026-03-05'), 15);
  assert.equal(daysLeft('2026-03-20', '2026-03-19'), 1);
});

test('period length follows the calendar', () => {
  assert.equal(periodDays('2026-02-20', '2026-03-20'), 28);
  assert.equal(periodDays('2026-03-20', '2026-04-20'), 31);
});

test('an upgrade halfway through the period', () => {
  const p = prorate({ oldPriceCents: 2900, newPriceCents: 7900, periodStart: '2026-02-20', periodEnd: '2026-03-20', changeDay: '2026-03-06' });
  assert.deepEqual(p, { daysLeft: 14, periodDays: 28, credit: 1450, charge: 3950, net: 2500 });
});
