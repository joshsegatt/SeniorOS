import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryKv } from '../../src/cache/kv.js';
import { createBasketStore } from '../../src/basket/store.js';
import { createBasketService } from '../../src/basket/service.js';

const tea = { sku: 'tea', name: 'Green tea', priceCents: 1250, qty: 2 };
const cup = { sku: 'cup', name: 'Cup', priceCents: 899, qty: 1 };

test('the summary carries the coupon discount', async () => {
  const baskets = createBasketStore([{ id: 'b1', items: [tea, cup], coupon: 'TEN' }]);
  const service = createBasketService({ baskets, kv: createMemoryKv() });
  const summary = await service.getSummary('b1');
  assert.equal(summary.subtotalCents, 3399);
  assert.equal(summary.discountCents, 339);
  assert.equal(summary.totalCents, 3060);
});

test('no coupon, no discount', async () => {
  const baskets = createBasketStore([{ id: 'b1', items: [tea], coupon: null }]);
  const service = createBasketService({ baskets, kv: createMemoryKv() });
  const summary = await service.getSummary('b1');
  assert.equal(summary.discountCents, 0);
  assert.equal(summary.totalCents, 2500);
});

test('the discount follows coupon changes', async () => {
  const baskets = createBasketStore([{ id: 'b1', items: [tea, cup], coupon: null }]);
  const service = createBasketService({ baskets, kv: createMemoryKv() });
  assert.equal((await service.getSummary('b1')).discountCents, 0);
  await service.applyCoupon('b1', 'STAFF25');
  assert.equal((await service.getSummary('b1')).discountCents, 849);
});

test('right after the deploy, summaries cached by the previous release do not hide the discount', async () => {
  // ShopKV is not flushed on deploy: this is what the release before the change cached for basket b1.
  const kv = createMemoryKv({ 'basket-summary:v3:b1': { itemCount: 3, subtotalCents: 3399, totalCents: 3060 } });
  const baskets = createBasketStore([{ id: 'b1', items: [tea, cup], coupon: 'TEN' }]);
  const service = createBasketService({ baskets, kv });
  const summary = await service.getSummary('b1');
  assert.equal(summary.discountCents, 339, `checkout shows a summary without the discount: ${JSON.stringify(summary)}`);
  assert.equal(summary.totalCents, 3060);
});

test('the new summary is still cached', async () => {
  const baskets = createBasketStore([{ id: 'b1', items: [tea], coupon: 'TEN' }]);
  const service = createBasketService({ baskets, kv: createMemoryKv() });
  await service.getSummary('b1');
  await service.getSummary('b1');
  await service.getSummary('b1');
  assert.equal(baskets.reads, 1);
});
