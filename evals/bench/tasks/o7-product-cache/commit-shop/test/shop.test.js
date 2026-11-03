import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/shop/db.js';
import { createCatalog } from '../src/shop/catalog.js';
import { createStorefront } from '../src/shop/storefront.js';
import { importPrices } from '../src/shop/price-import.js';

const clock = { now: () => new Date('2026-10-20T12:00:00Z') };
const seed = () => ({
  products: [
    { id: 'tea', name: 'Green tea', priceCents: 1250, stock: 4, createdAt: '2026-10-10T00:00:00Z' },
    { id: 'pot', name: 'Teapot', priceCents: 3900, stock: 0, createdAt: '2026-01-05T00:00:00Z' },
  ],
});

test('getProduct returns the product with a new badge for recent products', () => {
  const catalog = createCatalog({ db: createDb(seed()), clock });
  assert.deepEqual(catalog.getProduct('tea'), { id: 'tea', name: 'Green tea', priceCents: 1250, stock: 4, isNew: true });
  assert.equal(catalog.getProduct('pot')?.isNew, false);
  assert.equal(catalog.getProduct('nope'), null);
});

test('product page shows price and stock', () => {
  const storefront = createStorefront({ catalog: createCatalog({ db: createDb(seed()), clock }) });
  const page = storefront.productPage('pot');
  assert.equal(page.status, 200);
  assert.equal(page.body.price, 'CHF 39.00');
  assert.equal(page.body.inStock, false);
  assert.equal(storefront.productPage('nope').status, 404);
});

test('listing shows every product', () => {
  const storefront = createStorefront({ catalog: createCatalog({ db: createDb(seed()), clock }) });
  assert.deepEqual(storefront.listing().body.map((p) => p.id), ['pot', 'tea']);
});

test('price import updates known products and reports bad lines', () => {
  const db = createDb(seed());
  const result = importPrices(db, '# id,cents\ntea,1300\nghost,100\npot,abc\n');
  assert.deepEqual(result, { updated: 1, errors: ['line 3: unknown product ghost', 'line 4: bad price'] });
  assert.equal(db.getProduct('tea')?.priceCents, 1300);
});
