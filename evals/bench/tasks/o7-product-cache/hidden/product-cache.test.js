import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../../src/shop/db.js';
import { createCatalog } from '../../src/shop/catalog.js';
import { createShop } from '../../src/shop/app.js';

const T0 = Date.parse('2026-10-20T12:00:00Z');
const seed = () => ({
  products: [
    { id: 'tea', name: 'Green tea', priceCents: 1250, stock: 5, createdAt: '2026-10-10T00:00:00Z' },
    { id: 'pot', name: 'Teapot', priceCents: 3900, stock: 2, createdAt: '2026-01-05T00:00:00Z' },
  ],
});

/** A controllable time source: the injected clock and Date.now move together, so either way of reading time works. */
function fakeTime(t) {
  let now = T0;
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: T0 });
  return {
    clock: { now: () => new Date(now) },
    advance(ms) {
      now += ms;
      t.mock.timers.tick(ms);
    },
  };
}

test('repeat reads within 60 seconds are served from the cache', (t) => {
  const time = fakeTime(t);
  const db = createDb(seed());
  const catalog = createCatalog({ db, clock: time.clock });
  const first = catalog.getProduct('tea');
  const reads = db.stats.reads;
  time.advance(30_000);
  assert.deepEqual(catalog.getProduct('tea'), first);
  time.advance(29_000);
  catalog.getProduct('tea');
  assert.equal(db.stats.reads, reads, 'no database read within the TTL');
});

test('the cache expires after 60 seconds and each product is cached on its own', (t) => {
  const time = fakeTime(t);
  const db = createDb(seed());
  const catalog = createCatalog({ db, clock: time.clock });
  catalog.getProduct('tea');
  const afterTea = db.stats.reads;
  assert.equal(catalog.getProduct('pot')?.name, 'Teapot');
  assert.ok(db.stats.reads > afterTea, 'another product is read from the database');
  const before = db.stats.reads;
  time.advance(61_000);
  catalog.getProduct('tea');
  assert.ok(db.stats.reads > before, 'read again after the TTL');
});

test('the storefront puts much less load on the database', (t) => {
  const time = fakeTime(t);
  const shop = createShop({ seed: seed(), clock: time.clock });
  for (let i = 0; i < 20; i += 1) shop.storefront.productPage('tea');
  assert.ok(shop.db.stats.reads <= 2, `20 page views made ${shop.db.stats.reads} reads`);
});

test('a price upload is visible right away, within the TTL', (t) => {
  const time = fakeTime(t);
  const shop = createShop({ seed: seed(), clock: time.clock });
  shop.storefront.productPage('tea');
  shop.admin.importPrices('tea,990\n');
  time.advance(1_000);
  assert.equal(shop.storefront.productPage('tea').body.price, 'CHF 9.90');
});

test('stock taken by an order is seen by the next checkout, within the TTL', (t) => {
  const time = fakeTime(t);
  const shop = createShop({ seed: seed(), clock: time.clock });
  assert.equal(shop.orders.placeOrder({ productId: 'pot', qty: 2 }).ok, true);
  time.advance(1_000);
  assert.deepEqual(shop.orders.placeOrder({ productId: 'pot', qty: 1 }), { ok: false, error: 'out of stock' });
  assert.equal(shop.db.getProduct('pot')?.stock, 0);
});
