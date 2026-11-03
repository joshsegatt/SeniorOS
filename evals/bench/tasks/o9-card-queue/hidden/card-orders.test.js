import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderStore } from '../../src/orders/store.js';
import { customerOrderView, markPaidByTransfer, placeOrder, refundWindowOpen } from '../../src/orders/orders.js';
import { shippingQueue, stuckOrders } from '../../src/warehouse/queue.js';
import { handlePaymentEvent } from '../../src/payments/webhook.js';
import { cardPayoutReport } from '../../src/finance/payouts.js';

const at = (iso) => new Date(iso);
const secs = (iso) => Math.floor(Date.parse(iso) / 1000);

/** One order paid by card through the provider webhook, one by bank transfer. */
function shop(cardPaidAt, transferPaidAt = '2026-10-20T06:00:00Z') {
  const store = createOrderStore();
  const card = placeOrder(store, { customerId: 'c1', totalCents: 4200 }, at('2026-09-30T08:00:00Z'));
  const transfer = placeOrder(store, { customerId: 'c2', totalCents: 1500 }, at('2026-09-30T08:30:00Z'));
  const r = handlePaymentEvent(store, { id: 'ev_1', type: 'charge.succeeded', created: secs(cardPaidAt), data: { orderId: card.id, amountCents: 4200 } });
  assert.deepEqual(r, { handled: true });
  markPaidByTransfer(store, transfer.id, at(transferPaidAt));
  return { store, card, transfer };
}

test('the reported case: an order paid by card this morning is in the shipping queue', () => {
  const { store, card, transfer } = shop('2026-10-20T07:15:00Z');
  const queue = shippingQueue(store, at('2026-10-20T10:00:00Z'));
  assert.deepEqual(queue.map((q) => q.id), [transfer.id, card.id]);
  assert.equal(queue.find((q) => q.id === card.id).waitingHours, 2);
});

test('a card order still unshipped after two weeks is reported as stuck', () => {
  const { store, card } = shop('2026-10-01T07:15:00Z');
  assert.deepEqual(stuckOrders(store, at('2026-10-20T10:00:00Z')), [card.id]);
  assert.deepEqual(shippingQueue(store, at('2026-10-20T10:00:00Z')).map((q) => q.id).includes(card.id), false);
});

test('the card payout report counts card payments of that day', () => {
  const { store } = shop('2026-10-20T07:15:00Z');
  assert.deepEqual(cardPayoutReport(store, '2026-10-20'), { day: '2026-10-20', orders: 1, grossCents: 4200 });
  assert.deepEqual(cardPayoutReport(store, '2026-10-19'), { day: '2026-10-19', orders: 0, grossCents: 0 });
});

test('customers who paid by card can ask for a refund within 30 days', () => {
  const { store, card } = shop('2026-10-20T07:15:00Z');
  const order = store.get(card.id);
  assert.equal(refundWindowOpen(order, at('2026-11-01T10:00:00Z')), true);
  assert.equal(refundWindowOpen(order, at('2026-12-01T10:00:00Z')), false);
  assert.equal(customerOrderView(order).paidOn, '2026-10-20');
});

test('a refund from the provider shows its date to the customer', () => {
  const { store, card } = shop('2026-10-20T07:15:00Z');
  assert.deepEqual(handlePaymentEvent(store, { id: 'ev_2', type: 'charge.refunded', created: secs('2026-10-22T16:00:00Z'), data: { orderId: card.id, amountCents: 4200 } }), { handled: true });
  const view = customerOrderView(store.get(card.id));
  assert.equal(view.status, 'refunded');
  assert.equal(view.refundedOn, '2026-10-22');
});
