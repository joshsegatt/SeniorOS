import test from 'node:test';
import assert from 'node:assert/strict';
import { changePlan, renew, subscribe } from '../src/billing/subscriptions.js';
import { addMonths, daysBetween } from '../src/billing/dates.js';
import { lumen, northwind } from '../src/billing/__tests__/fixtures.js';

test('a subscription runs one calendar month at a time', () => {
  assert.deepEqual(northwind(), { id: 'sub-311', customer: 'Northwind Traders', planId: 'team', periodStart: '2025-12-20', periodEnd: '2026-01-20' });
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(daysBetween('2026-02-20', '2026-03-20'), 28);
  assert.throws(() => subscribe('x', 'X', 'gold', '2026-01-01'), /unknown plan/);
});

test('renewal bills the next month in full', () => {
  const { subscription, lines } = renew(northwind());
  assert.equal(subscription.periodStart, '2026-01-20');
  assert.equal(subscription.periodEnd, '2026-02-20');
  assert.deepEqual(lines, [{ description: 'Team plan (2026-01-20 to 2026-02-20)', amountCents: 2900 }]);
});

test('a mid-period upgrade credits the old plan and charges the new one', () => {
  const { subscription, lines } = changePlan(lumen(), 'team', '2026-03-17');
  assert.equal(subscription.planId, 'team');
  assert.deepEqual(lines, [
    { description: 'Unused time on Starter (15 of 31 days)', amountCents: -435 },
    { description: 'Remaining time on Team (15 of 31 days)', amountCents: 1403 },
  ]);
});

test('plan changes stay inside the current period', () => {
  assert.throws(() => changePlan(northwind(), 'business', '2026-01-20'), /outside the current period/);
  assert.throws(() => changePlan(northwind(), 'business', '2025-12-19'), /outside the current period/);
  assert.throws(() => changePlan(northwind(), 'team', '2025-12-23'), /already on this plan/);
});
