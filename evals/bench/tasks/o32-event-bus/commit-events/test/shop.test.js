import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopApp } from '../src/shop/app.js';
import { createEvents } from '../src/lib/events.js';

function fakePayments() {
  const p = { charges: [], refunds: [] };
  p.charge = (customerId, cents) => (p.charges.push({ customerId, cents }), `pay_${p.charges.length}`);
  p.refund = (paymentId) => p.refunds.push(paymentId);
  return p;
}
const cart = (lines) => ({ customerId: 'c1', email: 'ana@example.com', lines });

test('placing an order charges, reserves stock, awards points and mails', async () => {
  const payments = fakePayments();
  const app = createShopApp({ stock: { MUG: 5 }, payments });
  const res = await app.api.placeOrder(cart([{ sku: 'MUG', qty: 2, unitCents: 1250 }]));
  assert.deepEqual(res, { status: 201, body: { id: 'o1', status: 'paid', totalCents: 2500 } });
  assert.deepEqual(payments.charges, [{ customerId: 'c1', cents: 2500 }]);
  assert.equal(app.inventory.level('MUG'), 3);
  assert.equal(app.loyalty.points('c1'), 25);
  assert.deepEqual(app.outbox, [{ to: 'ana@example.com', template: 'order-confirmation', orderId: 'o1' }]);
});

test('cancelling refunds and gives everything back', async () => {
  const payments = fakePayments();
  const app = createShopApp({ stock: { MUG: 5 }, payments });
  const order = await app.checkout.place(cart([{ sku: 'MUG', qty: 2, unitCents: 1250 }]));
  await app.checkout.cancel(order);
  assert.deepEqual(payments.refunds, ['pay_1']);
  assert.equal(app.inventory.level('MUG'), 5);
  assert.equal(app.loyalty.points('c1'), 0);
  assert.equal(app.outbox.at(-1).template, 'order-cancelled');
});

test('an empty cart is a bad request', async () => {
  const app = createShopApp({ stock: {}, payments: fakePayments() });
  assert.equal((await app.api.placeOrder(cart([]))).status, 400);
});

test('events: publish waits for subscribers', async () => {
  const events = createEvents();
  const seen = [];
  events.subscribe('ping', async (n) => {
    await new Promise((r) => setTimeout(r, 5));
    seen.push(n);
  });
  await events.publish('ping', 1);
  assert.deepEqual(seen, [1]);
});
