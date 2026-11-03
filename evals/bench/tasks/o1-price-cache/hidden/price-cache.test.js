import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductDb } from '../../src/catalog/db.js';
import { createCatalog, ProductNotFound } from '../../src/catalog/catalog.js';
import { priceCart } from '../../src/catalog/cart-pricing.js';

const seed = () => [
  { id: 'p1', name: 'Mug', priceCents: 1000 },
  { id: 'p2', name: 'Tea', priceCents: 800 },
  { id: 'p3', name: 'Pot', priceCents: 3000 },
];

const settle = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Wraps the real db and lets a test hold the replies of chosen methods. The query itself runs when called
 * (a read sees the row as it is at that moment); only its reply reaches the caller when released.
 */
function controlledDb(db) {
  const calls = {};
  const holding = new Set();
  /** @type {(() => void)[]} */
  let held = [];
  const proxy = new Proxy(db, {
    get(target, key) {
      const value = target[key];
      if (typeof value !== 'function') return value;
      return (...args) => {
        calls[key] = (calls[key] ?? 0) + 1;
        const result = value.apply(target, args);
        if (!holding.has(key)) return result;
        return new Promise((resolve, reject) => held.push(() => result.then(resolve, reject)));
      };
    },
  });
  return {
    db: proxy,
    calls,
    hold: (key) => holding.add(key),
    unhold: (key) => holding.delete(key),
    release: () => {
      const run = held;
      held = [];
      for (const f of run) f();
    },
    get heldCount() {
      return held.length;
    },
  };
}

test('repeated reads of a product are served from the cache', async () => {
  const c = controlledDb(createProductDb(seed()));
  const catalog = createCatalog({ db: c.db });
  for (let i = 0; i < 5; i += 1) assert.equal((await catalog.getProduct('p1')).priceCents, 1000);
  assert.equal(c.calls.getProduct, 1);
  await priceCart(catalog, [{ productId: 'p1', qty: 1 }, { productId: 'p2', qty: 2 }]);
  await priceCart(catalog, [{ productId: 'p1', qty: 1 }, { productId: 'p2', qty: 2 }]);
  assert.equal(c.calls.getProduct, 2);
});

test('a price change shows up on the next read', async () => {
  const catalog = createCatalog({ db: createProductDb(seed()) });
  assert.equal((await catalog.getProduct('p2')).priceCents, 800);
  await catalog.updatePrice('p2', 950);
  assert.equal((await catalog.getProduct('p2')).priceCents, 950);
  const cart = await priceCart(catalog, [{ productId: 'p2', qty: 2 }]);
  assert.equal(cart.totalCents, 1900);
  assert.equal((await catalog.getProduct('p3')).priceCents, 3000);
});

test('unknown products still fail', async () => {
  const catalog = createCatalog({ db: createProductDb(seed()) });
  await assert.rejects(catalog.getProduct('nope'), ProductNotFound);
  await assert.rejects(catalog.updatePrice('p1', 0), RangeError);
});

test('a read that was in flight during a price change does not bring the old price back', async () => {
  const c = controlledDb(createProductDb(seed()));
  const catalog = createCatalog({ db: c.db });

  // A product page starts loading p1; its query has run (old price) but the reply is still on the wire.
  c.hold('getProduct');
  const pageView = catalog.getProduct('p1');
  await settle();
  assert.equal(c.heldCount, 1, 'the first read should reach the database');
  c.unhold('getProduct');

  // Meanwhile the admin changes the price, and that call completes.
  await catalog.updatePrice('p1', 2500);

  // Now the old reply arrives.
  c.release();
  await pageView;
  await settle();

  assert.equal((await catalog.getProduct('p1')).priceCents, 2500, 'price change lost: the cache holds the pre-change price');
  const cart = await priceCart(catalog, [{ productId: 'p1', qty: 1 }]);
  assert.equal(cart.totalCents, 2500);
});

test('a read that runs while the price write is in flight is not kept as the cached price', async () => {
  const c = controlledDb(createProductDb(seed()));
  const catalog = createCatalog({ db: c.db });
  assert.equal((await catalog.getProduct('p3')).priceCents, 3000);

  c.hold('setPrice');
  const update = catalog.updatePrice('p3', 3500);
  await settle();
  // A read during the write may see the old price; that is fine for that read...
  await catalog.getProduct('p3');
  c.unhold('setPrice');
  c.release();
  await update;

  // ...but once updatePrice has returned, every read sees the new price.
  assert.equal((await catalog.getProduct('p3')).priceCents, 3500);
});
