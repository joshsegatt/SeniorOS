import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGateway } from '../vendor/paygate.js';
import { createStock } from '../src/stock.js';
import { createOrdering } from '../src/ordering.js';

const setup = () => {
  const gateway = createFakeGateway();
  const stock = createStock({ tea: 5 });
  return { gateway, stock, ordering: createOrdering({ gateway, stock }) };
};

test('placing an order takes stock and charges the total', async () => {
  const { stock, ordering } = setup();
  const order = await ordering.placeOrder('o1', [{ sku: 'tea', priceCents: 1000, qty: 2 }], 'US');
  assert.equal(order.totalCents, 2000);
  assert.equal(order.status, 'placed');
  assert.equal(stock.stockOf('tea'), 3);
});

test('an order without enough stock is refused and takes nothing', async () => {
  const { stock, ordering } = setup();
  await assert.rejects(ordering.placeOrder('o1', [{ sku: 'tea', priceCents: 1000, qty: 9 }], 'US'));
  assert.equal(stock.stockOf('tea'), 5);
});
