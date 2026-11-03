// End-to-end flows through the wired shop (createShop), the way the storefront and back office use it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createShop } from '../src/shop/app.js';

const seed = () => ({
  products: [
    { id: 'tea', name: 'Green tea', priceCents: 1250, stock: 5, createdAt: '2026-10-10T00:00:00Z' },
    { id: 'pot', name: 'Teapot', priceCents: 3900, stock: 2, createdAt: '2026-01-05T00:00:00Z' },
  ],
});
const clock = { now: () => new Date('2026-10-20T12:00:00Z') };

test('a customer browses and buys', () => {
  const shop = createShop({ seed: seed(), clock });
  assert.equal(shop.storefront.productPage('tea').body.price, 'CHF 12.50');
  const placed = shop.orders.placeOrder({ productId: 'tea', qty: 2 });
  assert.equal(placed.ok, true);
  assert.equal(placed.order.totalCents, 2500);
  assert.equal(shop.storefront.productPage('tea').body.stockLeft, 3);
});

test('stock cannot be oversold', () => {
  const shop = createShop({ seed: seed(), clock });
  assert.equal(shop.storefront.productPage('pot').body.stockLeft, 2);
  assert.equal(shop.orders.placeOrder({ productId: 'pot', qty: 2 }).ok, true);
  assert.deepEqual(shop.orders.placeOrder({ productId: 'pot', qty: 1 }), { ok: false, error: 'out of stock' });
  assert.equal(shop.storefront.productPage('pot').body.inStock, false);
});

test('a price list upload shows on the storefront and is charged at checkout', () => {
  const shop = createShop({ seed: seed(), clock });
  assert.equal(shop.storefront.productPage('tea').body.price, 'CHF 12.50');
  assert.deepEqual(shop.admin.importPrices('tea,990\n'), { updated: 1, errors: [] });
  assert.equal(shop.storefront.productPage('tea').body.price, 'CHF 9.90');
  assert.equal(shop.orders.placeOrder({ productId: 'tea', qty: 1 }).order.totalCents, 990);
});
