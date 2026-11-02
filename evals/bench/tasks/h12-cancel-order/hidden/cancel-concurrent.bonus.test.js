import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGateway } from '../../vendor/paygate.js';
import { createStock } from '../../src/stock.js';
import { createOrdering } from '../../src/ordering.js';

test('two cancels at the same time (a double click) refund once and put the items back once', async () => {
  const gateway = createFakeGateway();
  const stock = createStock({ tea: 5 });
  const ordering = createOrdering({ gateway, stock });
  const order = await ordering.placeOrder('o1', [{ sku: 'tea', priceCents: 1000, qty: 2 }], 'US');
  await Promise.allSettled([ordering.cancelOrder('o1'), ordering.cancelOrder('o1')]);
  assert.equal(gateway.refundedFor(order.chargeId), order.totalCents);
  assert.equal(stock.stockOf('tea'), 5);
  assert.equal(ordering.getOrder('o1').status, 'cancelled');
});
