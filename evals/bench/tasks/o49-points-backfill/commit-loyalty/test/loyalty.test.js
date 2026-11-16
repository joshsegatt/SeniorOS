import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/db/store.js';
import { placeOrder, cancelOrder } from '../src/orders/orders.js';
import { POINTS_LAUNCH, pointsFor, redeemPoints } from '../src/loyalty/points.js';
import { balanceMismatches, ledgerBalance, pointsStatement } from '../src/loyalty/ledger.js';
import { run as normalizeEmails } from '../scripts/normalize-emails.js';

const at = (iso) => () => new Date(iso);

function shop() {
  return createStore({
    customers: [
      { id: 'c-1', name: 'Dana Reyes', email: 'dana@example.com' },
      { id: 'c-2', name: 'Omar Haddad', email: ' Omar.Haddad@Example.com' },
    ],
  });
}

test('one point per whole euro', () => {
  assert.equal(pointsFor({ totalCents: 8490 }), 84);
  assert.equal(pointsFor({ totalCents: 99 }), 0);
  assert.ok(Date.parse(POINTS_LAUNCH) > 0);
});

test('a paid order earns points and shows on the statement', () => {
  const store = shop();
  const order = placeOrder(store, { customerId: 'c-1', totalCents: 3999 }, at('2026-11-05T15:00:00Z'));
  assert.deepEqual(pointsStatement(store, 'c-1'), { customerId: 'c-1', balance: 39, entries: [{ at: '2026-11-05T15:00:00.000Z', type: 'earn', orderId: order.id, points: 39 }] });
  assert.throws(() => placeOrder(store, { customerId: 'c-9', totalCents: 100 }), /unknown customer/);
  assert.throws(() => placeOrder(store, { customerId: 'c-1', totalCents: 0 }), /totalCents/);
});

test('redeeming and cancelling move the balance and the ledger together', () => {
  const store = shop();
  const order = placeOrder(store, { customerId: 'c-1', totalCents: 8000 }, at('2026-11-06T09:00:00Z'));
  placeOrder(store, { customerId: 'c-1', totalCents: 2500 }, at('2026-11-07T09:00:00Z'));
  redeemPoints(store, 'c-1', 20, 'o-x', at('2026-11-08T09:00:00Z'));
  assert.throws(() => redeemPoints(store, 'c-1', 1000, 'o-y'), /not enough points/);
  cancelOrder(store, order.id, at('2026-11-09T09:00:00Z'));
  cancelOrder(store, order.id, at('2026-11-09T10:00:00Z'));
  assert.equal(store.get('customers', 'c-1').points, 80 + 25 - 20 - 80);
  assert.equal(ledgerBalance(store, 'c-1'), 5);
  assert.deepEqual(balanceMismatches(store), []);
});

test('the email clean-up script', () => {
  const store = shop();
  assert.deepEqual(normalizeEmails(store), { changed: 1 });
  assert.equal(store.get('customers', 'c-2').email, 'omar.haddad@example.com');
  assert.deepEqual(normalizeEmails(store), { changed: 0 });
});
