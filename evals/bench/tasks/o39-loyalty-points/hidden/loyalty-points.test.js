import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLoyaltyStore } from '../../src/loyalty/store.js';
import { activateCard } from '../../src/loyalty/members.js';
import { pointsBalance } from '../../src/loyalty/points.js';
import { freeDrinkStatus } from '../../src/loyalty/rewards.js';
import { recordPurchase } from '../../src/pos/register.js';
import { syncRegisterBatch } from '../../src/pos/sync.js';
import { placeAppOrder } from '../../src/app/orders.js';
import { monthlyHistoryEmail } from '../../src/email/monthly.js';

const batch = () => JSON.parse(readFileSync(new URL('../../data/harbor-st-batch-2026-10-28.json', import.meta.url), 'utf8'));
const day = (d) => () => new Date(`2026-10-${String(d).padStart(2, '0')}T07:45:00Z`);

function harborSt() {
  const store = createLoyaltyStore();
  const dana = activateCard(store, { name: 'Dana Reyes', email: 'dana.reyes@example.com', cardNumber: 'LC-2047' }, day(1));
  const omar = activateCard(store, { name: 'Omar Haddad', email: 'omar.h@example.com', cardNumber: 'LC-1983' }, day(1));
  const priya = activateCard(store, { name: 'Priya Nair', email: 'priya.nair@example.com', cardNumber: 'LC-2210' }, day(1));
  // Dana's six earlier purchases, rung up on connected registers.
  for (let i = 0; i < 6; i += 1) recordPurchase(store, { receipt: `PA1-07${i}`, cardNumber: 'LC-2047', storeId: 'pier-ave', totalCents: 500 }, day(2 + i * 3));
  return { store, dana: dana.id, omar: omar.id, priya: priya.id };
}

test('the reported case: Dana gets the points for her four Harbor St purchases', () => {
  const { store, dana, omar, priya } = harborSt();
  assert.equal(pointsBalance(store, dana), 30);
  syncRegisterBatch(store, batch());
  assert.equal(pointsBalance(store, dana), 58);
  assert.equal(pointsBalance(store, omar), 11);
  assert.equal(pointsBalance(store, priya), 8);
});

test('purchases from the register sync count on the free-drink stamp card', () => {
  const { store, dana, omar } = harborSt();
  syncRegisterBatch(store, batch());
  assert.deepEqual(freeDrinkStatus(store, dana), { purchases: 10, freeDrinksEarned: 1, purchasesToNext: 10 });
  assert.deepEqual(freeDrinkStatus(store, omar), { purchases: 1, freeDrinksEarned: 0, purchasesToNext: 9 });
});

test('the monthly email lists the purchases from the register sync', () => {
  const { store, dana } = harborSt();
  syncRegisterBatch(store, batch());
  const email = monthlyHistoryEmail(store, dana, '2026-10');
  assert.equal(email.lines.length, 10);
  assert.deepEqual(email.lines.slice(-4), [
    '2026-10-24  harbor-st  $6.45  +6 pts',
    '2026-10-25  harbor-st  $4.80  +4 pts',
    '2026-10-26  harbor-st  $12.95  +12 pts',
    '2026-10-27  harbor-st  $6.45  +6 pts',
  ]);
  assert.equal(email.pointsEarned, 58);
});

test('later purchases add to the synced ones', () => {
  const { store, dana } = harborSt();
  syncRegisterBatch(store, batch());
  placeAppOrder(store, { customerId: dana, storeId: 'harbor-st', totalCents: 700 }, day(29));
  recordPurchase(store, { receipt: 'HS1-20001', cardNumber: 'LC-2047', storeId: 'harbor-st', totalCents: 450 }, day(30));
  assert.equal(pointsBalance(store, dana), 69);
  assert.deepEqual(freeDrinkStatus(store, dana), { purchases: 12, freeDrinksEarned: 1, purchasesToNext: 8 });
});

test('the sync stays idempotent and connected registers and the app still work', () => {
  const { store, dana } = harborSt();
  assert.deepEqual(syncRegisterBatch(store, batch()), { added: 6, skipped: 2 });
  assert.deepEqual(syncRegisterBatch(store, batch()), { added: 0, skipped: 8 });
  assert.equal(pointsBalance(store, dana), 58);
  const store2 = createLoyaltyStore();
  const sam = activateCard(store2, { name: 'Sam Ortiz', email: 'sam@example.com', cardNumber: 'LC-1500' }, day(1));
  recordPurchase(store2, { receipt: 'PA1-0001', cardNumber: 'lc-1500', storeId: 'pier-ave', totalCents: 645 }, day(2));
  placeAppOrder(store2, { customerId: sam.id, storeId: 'harbor-st', totalCents: 850 }, day(3));
  assert.equal(pointsBalance(store2, sam.id), 14);
  assert.deepEqual(monthlyHistoryEmail(store2, sam.id, '2026-10').lines, ['2026-10-02  pier-ave  $6.45  +6 pts', '2026-10-03  harbor-st  $8.50  +8 pts']);
});
