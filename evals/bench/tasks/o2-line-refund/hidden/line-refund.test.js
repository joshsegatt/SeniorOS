import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGateway } from '../../src/billing/gateway.js';
import { createBillingService } from '../../src/billing/service.js';

async function setup(region, couponPercent, lines) {
  const gateway = createMemoryGateway();
  const billing = createBillingService({ gateway });
  const order = await billing.placeOrder({ customerId: 'c1', region, couponPercent, lines });
  return { gateway, billing, order, refunds: () => gateway.payment(order.paymentId).refunds };
}

/** The line's exact (unrounded) share of what the customer paid. */
function exactShare(order, lineId) {
  const line = order.lines.find((l) => l.id === lineId);
  return (order.totalCents * line.priceCents * line.qty) / order.subtotalCents;
}

function assertNear(actual, exact, label) {
  assert.ok(Math.abs(actual - exact) <= 1, `${label}: refunded ${actual}, its share is ${exact.toFixed(2)}`);
}

test('refunding one line refunds that line through the gateway', async () => {
  const { billing, order, refunds } = await setup('US', 0, [
    { sku: 'mug', priceCents: 2000, qty: 1 },
    { sku: 'tea', priceCents: 3000, qty: 2 },
  ]);
  await billing.refundLine(order.id, 'L2');
  assert.deepEqual(refunds(), [6000]);
  assert.equal(billing.getOrder(order.id).refundedCents, 6000);
});

test('a line refund gives back what the customer paid for it: its share of the coupon and the tax', async () => {
  const { billing, order, refunds } = await setup('DE', 10, [
    { sku: 'mug', priceCents: 1000, qty: 1 },
    { sku: 'pot', priceCents: 2000, qty: 1 },
  ]);
  assert.equal(order.totalCents, 3213);
  await billing.refundLine(order.id, 'L1');
  assert.equal(refunds().length, 1);
  assertNear(refunds()[0], exactShare(order, 'L1'), 'L1');
});

test('refunding every line of an order one by one gives back exactly what was charged (rounding up case)', async () => {
  const { billing, order, refunds } = await setup('DE', 0, [
    { sku: 'a', priceCents: 999, qty: 1 },
    { sku: 'b', priceCents: 999, qty: 1 },
    { sku: 'c', priceCents: 999, qty: 1 },
  ]);
  for (const id of ['L1', 'L2', 'L3']) await billing.refundLine(order.id, id);
  const paid = refunds();
  assert.equal(paid.length, 3);
  paid.forEach((cents, i) => assertNear(cents, exactShare(order, `L${i + 1}`), `L${i + 1}`));
  assert.equal(paid.reduce((a, b) => a + b, 0), order.totalCents);
  assert.equal(billing.getOrder(order.id).refundedCents, order.totalCents);
});

test('refunding every line of an order one by one gives back exactly what was charged (rounding down case, any order)', async () => {
  const { billing, order, refunds } = await setup('DE', 15, [
    { sku: 'a', priceCents: 2999, qty: 1 },
    { sku: 'b', priceCents: 1499, qty: 1 },
    { sku: 'c', priceCents: 4999, qty: 1 },
  ]);
  for (const id of ['L3', 'L1', 'L2']) await billing.refundLine(order.id, id);
  const paid = refunds();
  assert.equal(paid.length, 3);
  assert.equal(paid.reduce((a, b) => a + b, 0), order.totalCents, `customer paid ${order.totalCents}, got back ${paid.reduce((a, b) => a + b, 0)}`);
  ['L3', 'L1', 'L2'].forEach((id, i) => assertNear(paid[i], exactShare(order, id), id));
});

test('many small lines with quantities still add up to the charge', async () => {
  const lines = Array.from({ length: 7 }, (_, i) => ({ sku: `s${i}`, priceCents: 500 + (i % 2), qty: 1 + (i % 3) }));
  const { billing, order, refunds } = await setup('CH', 5, lines);
  for (const id of ['L4', 'L7', 'L1', 'L2', 'L6', 'L3', 'L5']) await billing.refundLine(order.id, id);
  assert.equal(refunds().reduce((a, b) => a + b, 0), order.totalCents);
});

test('after a line refund, refundOrder refunds only what is left', async () => {
  const { billing, order, refunds } = await setup('CH', 0, [
    { sku: 'a', priceCents: 700, qty: 1 },
    { sku: 'b', priceCents: 700, qty: 1 },
    { sku: 'c', priceCents: 700, qty: 1 },
  ]);
  await billing.refundLine(order.id, 'L2');
  await billing.refundOrder(order.id);
  assert.equal(refunds().reduce((a, b) => a + b, 0), order.totalCents);
  assert.equal(billing.getOrder(order.id).status, 'refunded');
});
