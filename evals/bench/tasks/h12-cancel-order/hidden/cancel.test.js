import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGateway } from '../../vendor/paygate.js';
import { createStock } from '../../src/stock.js';
import { createOrdering } from '../../src/ordering.js';

const setup = async () => {
  const gateway = createFakeGateway();
  const stock = createStock({ tea: 5, cake: 3 });
  const ordering = createOrdering({ gateway, stock });
  const order = await ordering.placeOrder('o1', [{ sku: 'tea', priceCents: 1000, qty: 2 }, { sku: 'cake', priceCents: 450, qty: 1 }], 'CH');
  return { gateway, stock, ordering, order };
};

const settle = async (promise) => {
  try {
    await promise;
    return true;
  } catch {
    return false;
  }
};

test('cancelling refunds the charged total, puts the items back and marks the order cancelled', async () => {
  const { gateway, stock, ordering, order } = await setup();
  await ordering.cancelOrder('o1');
  assert.equal(gateway.refundedFor(order.chargeId), order.totalCents);
  assert.equal(stock.stockOf('tea'), 5);
  assert.equal(stock.stockOf('cake'), 3);
  assert.equal(ordering.getOrder('o1').status, 'cancelled');
});

test('cancelling twice refunds once and puts the items back once', async () => {
  const { gateway, stock, ordering, order } = await setup();
  await ordering.cancelOrder('o1');
  await settle(ordering.cancelOrder('o1'));
  assert.equal(gateway.refundedFor(order.chargeId), order.totalCents);
  assert.equal(stock.stockOf('tea'), 5, 'the items went back to stock twice');
  assert.equal(ordering.getOrder('o1').status, 'cancelled');
});

test('a declined refund leaves the order placed and its items sold, and a later cancel completes it', async () => {
  const { gateway, stock, ordering, order } = await setup();
  gateway.failNext('declined');
  assert.equal(await settle(ordering.cancelOrder('o1')), false, 'cancelOrder hid a declined refund');
  assert.equal(gateway.refundedFor(order.chargeId), 0);
  assert.equal(stock.stockOf('tea'), 3, 'items went back to stock although the customer kept the money');
  assert.equal(ordering.getOrder('o1').status, 'placed');

  await ordering.cancelOrder('o1');
  assert.equal(gateway.refundedFor(order.chargeId), order.totalCents);
  assert.equal(stock.stockOf('tea'), 5);
  assert.equal(ordering.getOrder('o1').status, 'cancelled');
});

test('a refund that timed out after PayGate refunded can be retried without a second refund', async () => {
  const { gateway, stock, ordering, order } = await setup();
  gateway.failNext('timeout');
  const first = await settle(ordering.cancelOrder('o1'));
  if (!first) await ordering.cancelOrder('o1');
  assert.equal(gateway.refundedFor(order.chargeId), order.totalCents);
  assert.equal(stock.stockOf('tea'), 5);
  assert.equal(stock.stockOf('cake'), 3);
  assert.equal(ordering.getOrder('o1').status, 'cancelled');
});

test('a refund that timed out before PayGate got it is not taken as done', async () => {
  const { gateway, stock, ordering, order } = await setup();
  gateway.failNext('lost');
  const first = await settle(ordering.cancelOrder('o1'));
  if (!first) await ordering.cancelOrder('o1');
  assert.equal(gateway.refundedFor(order.chargeId), order.totalCents, 'the order was cancelled but the customer never got the money back');
  assert.equal(stock.stockOf('tea'), 5);
  assert.equal(ordering.getOrder('o1').status, 'cancelled');
});

test('cancelling an unknown order fails', async () => {
  const { ordering } = await setup();
  assert.equal(await settle(ordering.cancelOrder('nope')), false);
});
