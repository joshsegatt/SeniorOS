import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGateway } from '../src/billing/gateway.js';
import { createBillingService, priceOrder, BillingError } from '../src/billing/service.js';

test('priceOrder applies the coupon before tax', () => {
  const lines = [{ id: 'L1', sku: 'mug', priceCents: 1000, qty: 2 }, { id: 'L2', sku: 'tea', priceCents: 500, qty: 1 }];
  assert.deepEqual(priceOrder(lines, 'DE', 10), { subtotalCents: 2500, discountCents: 250, totalCents: 2678 });
  assert.deepEqual(priceOrder(lines, 'US'), { subtotalCents: 2500, discountCents: 0, totalCents: 2500 });
});

test('placing an order charges its total', async () => {
  const gateway = createMemoryGateway();
  const billing = createBillingService({ gateway });
  const order = await billing.placeOrder({ customerId: 'c1', region: 'CH', lines: [{ sku: 'mug', priceCents: 1000, qty: 1 }] });
  assert.equal(order.totalCents, 1081);
  assert.equal(order.lines[0].id, 'L1');
  assert.equal(gateway.payment(order.paymentId).capturedCents, 1081);
});

test('refundOrder refunds the whole order once', async () => {
  const gateway = createMemoryGateway();
  const billing = createBillingService({ gateway });
  const order = await billing.placeOrder({ customerId: 'c1', region: 'US', lines: [{ sku: 'mug', priceCents: 1500, qty: 2 }] });
  assert.equal(await billing.refundOrder(order.id), 3000);
  assert.equal(billing.getOrder(order.id).status, 'refunded');
  await assert.rejects(billing.refundOrder(order.id), BillingError);
  assert.deepEqual(gateway.payment(order.paymentId).refunds, [3000]);
});

test('the gateway never refunds more than it captured', async () => {
  const gateway = createMemoryGateway();
  const id = await gateway.charge(100);
  await gateway.refund(id, 60);
  await assert.rejects(gateway.refund(id, 41), { code: 'amount_too_large' });
});
