import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGateway } from '../../src/billing/gateway.js';
import { createBillingService } from '../../src/billing/service.js';

async function setup() {
  const gateway = createMemoryGateway();
  const billing = createBillingService({ gateway });
  const order = await billing.placeOrder({
    customerId: 'c1',
    region: 'US',
    lines: [{ sku: 'a', priceCents: 1000, qty: 1 }, { sku: 'b', priceCents: 2000, qty: 1 }],
  });
  return { gateway, billing, order };
}

test('the same line cannot be refunded twice', async () => {
  const { gateway, billing, order } = await setup();
  await billing.refundLine(order.id, 'L1');
  await assert.rejects(billing.refundLine(order.id, 'L1'));
  assert.deepEqual(gateway.payment(order.paymentId).refunds, [1000]);
});

test('unknown line is rejected', async () => {
  const { gateway, billing, order } = await setup();
  await assert.rejects(billing.refundLine(order.id, 'L9'));
  assert.deepEqual(gateway.payment(order.paymentId).refunds, []);
});

test('order status follows the line refunds', async () => {
  const { billing, order } = await setup();
  await billing.refundLine(order.id, 'L1');
  assert.equal(billing.getOrder(order.id).status, 'partially_refunded');
  await billing.refundLine(order.id, 'L2');
  assert.equal(billing.getOrder(order.id).status, 'refunded');
});
