import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoyaltyStore } from '../src/loyalty/store.js';
import { activateCard } from '../src/loyalty/members.js';
import { pointsBalance } from '../src/loyalty/points.js';
import { freeDrinkStatus } from '../src/loyalty/rewards.js';
import { recordPurchase } from '../src/pos/register.js';
import { syncRegisterBatch } from '../src/pos/sync.js';
import { placeAppOrder } from '../src/app/orders.js';
import { monthlyHistoryEmail } from '../src/email/monthly.js';

const t0 = new Date('2026-10-01T08:00:00Z');
const at = (days, hours = 0) => () => new Date(t0.getTime() + (days * 24 + hours) * 3_600_000);

function member(store) {
  return activateCard(store, { name: 'Sam Ortiz', email: 'Sam@Example.com', cardNumber: 'lc-1500' }, at(0));
}

test('a customer activates a card', () => {
  const store = createLoyaltyStore();
  const m = member(store);
  assert.equal(m.cardNumber, 'LC-1500');
  assert.equal(m.email, 'sam@example.com');
  assert.equal(pointsBalance(store, m.id), 0);
  assert.throws(() => activateCard(store, { name: 'Other', email: 'o@example.com', cardNumber: 'LC-1500' }), /already active/);
  assert.throws(() => activateCard(store, { name: 'Other', email: 'o@example.com', cardNumber: '1500' }), /card number/);
});

test('register purchases earn a point per whole dollar', () => {
  const store = createLoyaltyStore();
  const m = member(store);
  recordPurchase(store, { receipt: 'PA1-0001', cardNumber: 'LC-1500', storeId: 'pier-ave', totalCents: 645 }, at(1));
  recordPurchase(store, { receipt: 'PA1-0002', cardNumber: 'LC-1500', storeId: 'pier-ave', totalCents: 1299 }, at(2));
  assert.equal(pointsBalance(store, m.id), 18);
  assert.throws(() => recordPurchase(store, { receipt: 'PA1-0003', cardNumber: 'LC-9999', storeId: 'pier-ave', totalCents: 500 }), /unknown card/);
  assert.throws(() => recordPurchase(store, { receipt: 'PA1-0002', cardNumber: 'LC-1500', storeId: 'pier-ave', totalCents: 500 }), /already recorded/);
});

test('app orders count too', () => {
  const store = createLoyaltyStore();
  const m = member(store);
  placeAppOrder(store, { customerId: m.id, storeId: 'harbor-st', totalCents: 850 }, at(3));
  assert.equal(pointsBalance(store, m.id), 8);
  assert.throws(() => placeAppOrder(store, { customerId: 'c_999', storeId: 'harbor-st', totalCents: 850 }), /unknown member/);
});

test('a free drink every 10 purchases', () => {
  const store = createLoyaltyStore();
  const m = member(store);
  for (let i = 0; i < 9; i += 1) recordPurchase(store, { receipt: `PA1-01${i}`, cardNumber: 'LC-1500', storeId: 'pier-ave', totalCents: 400 }, at(i + 1));
  assert.deepEqual(freeDrinkStatus(store, m.id), { purchases: 9, freeDrinksEarned: 0, purchasesToNext: 1 });
  placeAppOrder(store, { customerId: m.id, storeId: 'pier-ave', totalCents: 400 }, at(11));
  assert.deepEqual(freeDrinkStatus(store, m.id), { purchases: 10, freeDrinksEarned: 1, purchasesToNext: 10 });
});

test('the monthly email lists the month purchases', () => {
  const store = createLoyaltyStore();
  const m = member(store);
  recordPurchase(store, { receipt: 'PA1-0001', cardNumber: 'LC-1500', storeId: 'pier-ave', totalCents: 645 }, at(1));
  placeAppOrder(store, { customerId: m.id, storeId: 'harbor-st', totalCents: 850 }, at(4));
  placeAppOrder(store, { customerId: m.id, storeId: 'harbor-st', totalCents: 500 }, at(35));
  const email = monthlyHistoryEmail(store, m.id, '2026-10');
  assert.equal(email.to, 'sam@example.com');
  assert.deepEqual(email.lines, ['2026-10-02  pier-ave  $6.45  +6 pts', '2026-10-05  harbor-st  $8.50  +8 pts']);
  assert.equal(email.pointsEarned, 14);
});

test('the register sync skips anonymous purchases and receipts already uploaded', () => {
  const store = createLoyaltyStore();
  member(store);
  const batch = {
    storeId: 'pier-ave',
    register: 'pier-ave-1',
    purchases: [
      { receipt: 'PA1-0201', customer: 'LC-1500', totalCents: 525, at: '2026-10-09T07:30:00Z' },
      { receipt: 'PA1-0202', customer: null, totalCents: 300, at: '2026-10-09T07:35:00Z' },
    ],
  };
  assert.deepEqual(syncRegisterBatch(store, batch), { added: 1, skipped: 1 });
  assert.deepEqual(syncRegisterBatch(store, batch), { added: 0, skipped: 2 });
  assert.equal(store.purchases().length, 1);
});
