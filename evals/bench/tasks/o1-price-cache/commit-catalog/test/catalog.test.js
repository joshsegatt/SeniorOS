import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductDb } from '../src/catalog/db.js';
import { createCatalog, ProductNotFound } from '../src/catalog/catalog.js';
import { priceCart } from '../src/catalog/cart-pricing.js';

const seed = () => [
  { id: 'p1', name: 'Mug', priceCents: 1200 },
  { id: 'p2', name: 'Tea', priceCents: 800 },
];

test('getProduct returns the product', async () => {
  const catalog = createCatalog({ db: createProductDb(seed()) });
  assert.deepEqual(await catalog.getProduct('p1'), { id: 'p1', name: 'Mug', priceCents: 1200 });
});

test('unknown product', async () => {
  const catalog = createCatalog({ db: createProductDb(seed()) });
  await assert.rejects(catalog.getProduct('nope'), ProductNotFound);
});

test('updatePrice changes the price', async () => {
  const catalog = createCatalog({ db: createProductDb(seed()) });
  await catalog.updatePrice('p2', 950);
  assert.equal((await catalog.getProduct('p2')).priceCents, 950);
});

test('updatePrice rejects bad prices', async () => {
  const catalog = createCatalog({ db: createProductDb(seed()) });
  await assert.rejects(catalog.updatePrice('p2', 0), RangeError);
  await assert.rejects(catalog.updatePrice('p2', 9.5), RangeError);
});

test('priceCart totals the cart', async () => {
  const catalog = createCatalog({ db: createProductDb(seed(), { latencyMs: 2 }) });
  const cart = await priceCart(catalog, [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }]);
  assert.equal(cart.totalCents, 3200);
  assert.equal(cart.lines[0].name, 'Mug');
});
