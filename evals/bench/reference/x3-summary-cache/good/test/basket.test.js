import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryKv } from '../src/cache/kv.js';
import { createBasketStore } from '../src/basket/store.js';
import { createBasketService } from '../src/basket/service.js';
import { computeSummary } from '../src/basket/summary.js';

const tea = { sku: 'tea', name: 'Green tea', priceCents: 1250, qty: 2 };
const cup = { sku: 'cup', name: 'Cup', priceCents: 899, qty: 1 };

function setup(basket = { id: 'b1', items: [tea], coupon: null }) {
  const baskets = createBasketStore([basket]);
  return { baskets, service: createBasketService({ baskets, kv: createMemoryKv() }) };
}

test('summary counts items and sums the subtotal', () => {
  assert.deepEqual(computeSummary({ id: 'b', items: [tea, cup], coupon: null }), { itemCount: 3, subtotalCents: 3399, discountCents: 0, totalCents: 3399 });
});

test('a coupon lowers the total, rounded down in the customer favour', () => {
  const summary = computeSummary({ id: 'b', items: [tea, cup], coupon: 'TEN' });
  assert.equal(summary.subtotalCents, 3399);
  assert.equal(summary.discountCents, 339);
  assert.equal(summary.totalCents, 3399 - 339);
});

test('the summary is cached', async () => {
  const { baskets, service } = setup();
  await service.getSummary('b1');
  await service.getSummary('b1');
  assert.equal(baskets.reads, 1);
});

test('changing the basket refreshes the summary', async () => {
  const { service } = setup();
  assert.equal((await service.getSummary('b1')).totalCents, 2500);
  await service.addItem('b1', cup);
  assert.equal((await service.getSummary('b1')).totalCents, 3399);
  await service.applyCoupon('b1', 'STAFF25');
  const summary = await service.getSummary('b1');
  assert.equal(summary.discountCents, 849);
  assert.equal(summary.totalCents, 3399 - 849);
  await assert.rejects(service.applyCoupon('b1', 'NOPE'));
});
