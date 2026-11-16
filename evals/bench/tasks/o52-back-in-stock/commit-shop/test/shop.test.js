import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/catalog/store.js';
import { getProduct } from '../src/catalog/products.js';
import { productAdminView, setStock } from '../src/admin/products.js';
import { receiveDelivery } from '../src/warehouse/deliveries.js';
import { placeOrder } from '../src/orders/orders.js';
import { normalizeEmail, sentEmails } from '../src/email/outbox.js';
import { productPage } from '../src/shop/product-page.js';

const at = (iso) => () => new Date(iso);

function shop() {
  return createStore({
    products: [
      { sku: 'APR-01', title: 'Linen apron', slug: 'linen-apron', priceCents: 3900, stock: 2 },
      { sku: 'MUG-02', title: 'Stoneware mug', slug: 'stoneware-mug', priceCents: 1490, stock: 12 },
    ],
  });
}

test('checkout takes stock and queues the confirmation', () => {
  const store = shop();
  const order = placeOrder(store, { email: ' Ana@Example.com ', lines: [{ sku: 'APR-01', quantity: 2 }] }, at('2026-11-02T10:00:00Z'));
  assert.equal(order.email, 'ana@example.com');
  assert.equal(order.totalCents, 7800);
  assert.equal(getProduct(store, 'APR-01').stock, 0);
  const [email] = sentEmails(store, 'order-confirmation');
  assert.equal(email.to, 'ana@example.com');
  assert.equal(email.subject, `Your order ${order.id}`);
  assert.throws(() => placeOrder(store, { email: 'bo@example.com', lines: [{ sku: 'APR-01', quantity: 1 }] }), /out of stock/);
});

test('the product page shows sold-out products', () => {
  const store = shop();
  assert.equal(productPage(store, 'APR-01').stockNote, 'Only 2 left');
  placeOrder(store, { email: 'ana@example.com', lines: [{ sku: 'APR-01', quantity: 2 }] });
  const page = productPage(store, 'APR-01');
  assert.equal(page.soldOut, true);
  assert.equal(page.addToCart, false);
  assert.equal(page.url, 'https://shop.example/products/linen-apron');
  assert.throws(() => productPage(store, 'NOPE'), /unknown product/);
});

test('the warehouse books in deliveries', () => {
  const store = shop();
  receiveDelivery(store, { sku: 'MUG-02', quantity: 24, supplier: 'Keramik Ost' }, at('2026-11-03T07:30:00Z'));
  assert.equal(getProduct(store, 'MUG-02').stock, 36);
  const view = productAdminView(store, 'MUG-02');
  assert.equal(view.lastDelivery, '2026-11-03T07:30:00.000Z');
  assert.equal(view.price, 'CHF 14.90');
  assert.throws(() => receiveDelivery(store, { sku: 'MUG-02', quantity: 0 }), /positive whole number/);
});

test('staff correct the stock count in the admin', () => {
  const store = shop();
  setStock(store, 'APR-01', 0, at('2026-11-04T16:00:00Z'));
  assert.equal(productAdminView(store, 'APR-01').status, 'sold out');
  setStock(store, 'APR-01', 5);
  assert.equal(productAdminView(store, 'APR-01').status, 'in stock');
  assert.throws(() => setStock(store, 'APR-01', -1), /whole number/);
});

test('email addresses are normalized', () => {
  assert.equal(normalizeEmail('  Bo@Example.CH '), 'bo@example.ch');
  assert.throws(() => normalizeEmail('bo at example'), /invalid email/);
});
