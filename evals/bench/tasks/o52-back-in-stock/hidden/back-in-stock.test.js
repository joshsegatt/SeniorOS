import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/catalog/store.js';
import { getProduct } from '../../src/catalog/products.js';
import { productAdminView, setStock } from '../../src/admin/products.js';
import { receiveDelivery } from '../../src/warehouse/deliveries.js';
import { placeOrder } from '../../src/orders/orders.js';
import { sentEmails } from '../../src/email/outbox.js';
import { productPage } from '../../src/shop/product-page.js';
import { subscribeBackInStock } from '../../src/shop/back-in-stock.js';

const at = (iso) => () => new Date(iso);

/** The linen apron sells out on 1 November; the mug stays in stock; the kettle has been sold out for a while. */
function shop() {
  const store = createStore({
    products: [
      { sku: 'APR-01', title: 'Linen apron', slug: 'linen-apron', priceCents: 3900, stock: 2 },
      { sku: 'MUG-02', title: 'Stoneware mug', slug: 'stoneware-mug', priceCents: 1490, stock: 12 },
      { sku: 'KTL-03', title: 'Enamel kettle', slug: 'enamel-kettle', priceCents: 4900, stock: 0 },
    ],
  });
  placeOrder(store, { email: 'first@example.com', lines: [{ sku: 'APR-01', quantity: 2 }] }, at('2026-11-01T09:00:00Z'));
  return store;
}

const backInStock = (store) => sentEmails(store, 'back-in-stock');

test('1. sign-up saves the address trimmed and in lower case, and rejects non-addresses', () => {
  const store = shop();
  const signup = subscribeBackInStock(store, 'APR-01', '  Ana.Keller@Example.COM ', at('2026-11-02T10:00:00Z'));
  assert.equal(signup.email, 'ana.keller@example.com');
  assert.equal(signup.sku, 'APR-01');
  assert.throws(() => subscribeBackInStock(store, 'APR-01', 'ana at example', at('2026-11-02T10:01:00Z')), /invalid email/);
  assert.throws(() => subscribeBackInStock(store, 'APR-01', '', at('2026-11-02T10:01:00Z')), /invalid email/);
});

test('2. sign-up only for sold-out products', () => {
  const store = shop();
  assert.throws(() => subscribeBackInStock(store, 'MUG-02', 'ana@example.com', at('2026-11-02T10:00:00Z')), /product is in stock/);
  assert.throws(() => subscribeBackInStock(store, 'NOPE-9', 'ana@example.com', at('2026-11-02T10:00:00Z')), /unknown product/);
  assert.ok(subscribeBackInStock(store, 'KTL-03', 'ana@example.com', at('2026-11-02T10:00:00Z')));
});

test('3. signing up twice keeps one sign-up and one email', () => {
  const store = shop();
  const first = subscribeBackInStock(store, 'APR-01', 'ana@example.com', at('2026-11-02T10:00:00Z'));
  const again = subscribeBackInStock(store, 'APR-01', ' ANA@example.com', at('2026-11-03T08:00:00Z'));
  assert.deepEqual(again, first);
  assert.equal(productAdminView(store, 'APR-01').waiting, 1);
  receiveDelivery(store, { sku: 'APR-01', quantity: 10 }, at('2026-11-10T07:00:00Z'));
  assert.deepEqual(backInStock(store).map((e) => e.to), ['ana@example.com']);
});

test('4. a warehouse delivery emails everyone waiting, in sign-up order', () => {
  const store = shop();
  subscribeBackInStock(store, 'APR-01', 'cleo@example.com', at('2026-11-02T10:00:00Z'));
  subscribeBackInStock(store, 'KTL-03', 'dan@example.com', at('2026-11-02T10:30:00Z'));
  subscribeBackInStock(store, 'APR-01', 'ana@example.com', at('2026-11-03T08:00:00Z'));
  subscribeBackInStock(store, 'APR-01', 'bo@example.com', at('2026-11-04T19:45:00Z'));
  receiveDelivery(store, { sku: 'APR-01', quantity: 20, supplier: 'Leinen AG' }, at('2026-11-10T07:00:00Z'));
  const emails = backInStock(store);
  assert.deepEqual(emails.map((e) => e.to), ['cleo@example.com', 'ana@example.com', 'bo@example.com']);
  for (const e of emails) {
    assert.equal(e.data.sku, 'APR-01');
    assert.equal(e.data.title, 'Linen apron');
    assert.equal(e.data.url, 'https://shop.example/products/linen-apron');
  }
  assert.equal(getProduct(store, 'APR-01').stock, 20);
});

test('4. a stock correction in the admin emails everyone waiting too', () => {
  const store = shop();
  subscribeBackInStock(store, 'APR-01', 'ana@example.com', at('2026-11-02T10:00:00Z'));
  subscribeBackInStock(store, 'APR-01', 'bo@example.com', at('2026-11-03T10:00:00Z'));
  setStock(store, 'APR-01', 0, at('2026-11-05T16:00:00Z'));
  assert.equal(backInStock(store).length, 0, 'still sold out: nobody should be emailed yet');
  setStock(store, 'APR-01', 3, at('2026-11-06T16:00:00Z'));
  assert.deepEqual(backInStock(store).map((e) => e.to), ['ana@example.com', 'bo@example.com']);
  assert.equal(backInStock(store)[0].data.url, 'https://shop.example/products/linen-apron');
});

test('5. one email per sign-up: a later restock does not email again', () => {
  const store = shop();
  subscribeBackInStock(store, 'APR-01', 'ana@example.com', at('2026-11-02T10:00:00Z'));
  receiveDelivery(store, { sku: 'APR-01', quantity: 1 }, at('2026-11-10T07:00:00Z'));
  assert.equal(backInStock(store).length, 1);
  assert.equal(productAdminView(store, 'APR-01').waiting, 0);
  placeOrder(store, { email: 'eve@example.com', lines: [{ sku: 'APR-01', quantity: 1 }] }, at('2026-11-10T09:00:00Z'));
  receiveDelivery(store, { sku: 'APR-01', quantity: 5 }, at('2026-11-20T07:00:00Z'));
  assert.equal(backInStock(store).length, 1);
  placeOrder(store, { email: 'eve@example.com', lines: [{ sku: 'APR-01', quantity: 5 }] }, at('2026-11-21T09:00:00Z'));
  subscribeBackInStock(store, 'APR-01', 'ana@example.com', at('2026-11-22T10:00:00Z'));
  receiveDelivery(store, { sku: 'APR-01', quantity: 5 }, at('2026-12-01T07:00:00Z'));
  assert.deepEqual(backInStock(store).map((e) => e.to), ['ana@example.com', 'ana@example.com']);
});

test('6. the admin product screen shows how many people are waiting', () => {
  const store = shop();
  assert.equal(productAdminView(store, 'APR-01').waiting, 0);
  subscribeBackInStock(store, 'APR-01', 'ana@example.com', at('2026-11-02T10:00:00Z'));
  subscribeBackInStock(store, 'APR-01', 'bo@example.com', at('2026-11-02T11:00:00Z'));
  subscribeBackInStock(store, 'KTL-03', 'cleo@example.com', at('2026-11-02T12:00:00Z'));
  assert.equal(productAdminView(store, 'APR-01').waiting, 2);
  assert.equal(productAdminView(store, 'KTL-03').waiting, 1);
  assert.equal(productAdminView(store, 'MUG-02').waiting, 0);
  assert.equal(productAdminView(store, 'APR-01').status, 'sold out');
});

test('7. the product page shows the form only on sold-out products', () => {
  const store = shop();
  assert.equal(productPage(store, 'APR-01').notifyMe, true);
  assert.equal(productPage(store, 'MUG-02').notifyMe, false);
  receiveDelivery(store, { sku: 'APR-01', quantity: 4 }, at('2026-11-10T07:00:00Z'));
  assert.equal(productPage(store, 'APR-01').notifyMe, false);
});

test('notes: a sign-up older than 90 days is dropped, not emailed', () => {
  const store = shop();
  subscribeBackInStock(store, 'KTL-03', 'old@example.com', at('2026-07-01T10:00:00Z'));
  subscribeBackInStock(store, 'KTL-03', 'fresh@example.com', at('2026-10-20T10:00:00Z'));
  receiveDelivery(store, { sku: 'KTL-03', quantity: 6 }, at('2026-11-10T07:00:00Z'));
  assert.deepEqual(backInStock(store).map((e) => e.to), ['fresh@example.com']);
  placeOrder(store, { email: 'eve@example.com', lines: [{ sku: 'KTL-03', quantity: 6 }] }, at('2026-11-11T09:00:00Z'));
  receiveDelivery(store, { sku: 'KTL-03', quantity: 6 }, at('2026-11-20T07:00:00Z'));
  assert.deepEqual(backInStock(store).map((e) => e.to), ['fresh@example.com'], 'the old sign-up must be gone, not kept for later');
});
