import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderStore } from '../src/orders/store.js';
import { customerOrderView, markPaidByTransfer, markShipped, placeOrder, refundWindowOpen } from '../src/orders/orders.js';
import { shippingQueue, stuckOrders } from '../src/warehouse/queue.js';
import { handlePaymentEvent } from '../src/payments/webhook.js';
import { cardPayoutReport } from '../src/finance/payouts.js';

const at = (iso) => new Date(iso);

test('a transfer payment puts the order in the shipping queue, oldest payment first', () => {
  const store = createOrderStore();
  const a = placeOrder(store, { customerId: 'c1', totalCents: 2500 }, at('2026-10-01T08:00:00Z'));
  const b = placeOrder(store, { customerId: 'c2', totalCents: 1200 }, at('2026-10-01T09:00:00Z'));
  markPaidByTransfer(store, b.id, at('2026-10-02T07:00:00Z'));
  markPaidByTransfer(store, a.id, at('2026-10-02T10:00:00Z'));
  const queue = shippingQueue(store, at('2026-10-02T12:00:00Z'));
  assert.deepEqual(queue.map((q) => [q.id, q.waitingHours]), [[b.id, 5], [a.id, 2]]);
});

test('shipped orders leave the queue; old unshipped ones are stuck', () => {
  const store = createOrderStore();
  const a = placeOrder(store, { customerId: 'c1', totalCents: 2500 }, at('2026-09-01T08:00:00Z'));
  const b = placeOrder(store, { customerId: 'c2', totalCents: 1200 }, at('2026-10-01T08:00:00Z'));
  markPaidByTransfer(store, a.id, at('2026-09-01T09:00:00Z'));
  markPaidByTransfer(store, b.id, at('2026-10-01T09:00:00Z'));
  markShipped(store, b.id, at('2026-10-01T15:00:00Z'));
  assert.deepEqual(shippingQueue(store, at('2026-10-02T12:00:00Z')), []);
  assert.deepEqual(stuckOrders(store, at('2026-10-02T12:00:00Z')), [a.id]);
});

test('refund window is 30 days from payment', () => {
  const store = createOrderStore();
  const a = placeOrder(store, { customerId: 'c1', totalCents: 2500 }, at('2026-09-01T08:00:00Z'));
  const paid = markPaidByTransfer(store, a.id, at('2026-09-01T09:00:00Z'));
  assert.equal(refundWindowOpen(paid, at('2026-09-20T09:00:00Z')), true);
  assert.equal(refundWindowOpen(paid, at('2026-10-05T09:00:00Z')), false);
  assert.equal(customerOrderView(paid).paidOn, '2026-09-01');
});

test('payout report only counts card payments', () => {
  const store = createOrderStore();
  const a = placeOrder(store, { customerId: 'c1', totalCents: 2500 }, at('2026-10-01T08:00:00Z'));
  markPaidByTransfer(store, a.id, at('2026-10-01T09:00:00Z'));
  assert.deepEqual(cardPayoutReport(store, '2026-10-01'), { day: '2026-10-01', orders: 0, grossCents: 0 });
});

test('webhook: a successful charge marks the order paid by card', () => {
  const store = createOrderStore();
  const a = placeOrder(store, { customerId: 'c1', totalCents: 2500 }, at('2026-10-01T08:00:00Z'));
  const r = handlePaymentEvent(store, { id: 'ev1', type: 'charge.succeeded', created: 1790000000, data: { orderId: a.id, amountCents: 2500 } });
  assert.deepEqual(r, { handled: true });
  assert.equal(store.get(a.id).status, 'paid');
  assert.equal(store.get(a.id).paymentMethod, 'card');
});

test('webhook: amount mismatch and unknown orders are not applied', () => {
  const store = createOrderStore();
  const a = placeOrder(store, { customerId: 'c1', totalCents: 2500 }, at('2026-10-01T08:00:00Z'));
  assert.equal(handlePaymentEvent(store, { id: 'ev1', type: 'charge.succeeded', created: 1790000000, data: { orderId: a.id, amountCents: 100 } }).handled, false);
  assert.equal(handlePaymentEvent(store, { id: 'ev2', type: 'charge.succeeded', created: 1790000000, data: { orderId: 'nope', amountCents: 100 } }).handled, false);
  assert.equal(store.get(a.id).status, 'pending');
});
