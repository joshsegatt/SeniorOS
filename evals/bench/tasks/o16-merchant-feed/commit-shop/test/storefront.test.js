import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createProductStore } from '../src/catalog/products.js';
import { productPage } from '../src/storefront/product-page.js';
import { formatPrice } from '../src/lib/money.js';

test('config: defaults overlaid with the environment file', () => {
  assert.equal(config.shop.currency, 'EUR');
  assert.equal(config.logLevel, 'debug');
});

test('prices are formatted for shoppers', () => {
  assert.equal(formatPrice(1500), '€15.00');
  assert.equal(formatPrice(99), '€0.99');
});

test('product pages show the price and whether it can be bought', () => {
  const store = createProductStore();
  store.put({ sku: 'MUG-1', title: 'Blue <Mug>', price: 1290, stock: 3, active: true });
  store.put({ sku: 'MUG-2', title: 'Red Mug', price: 1290, stock: 0, active: true });
  store.put({ sku: 'MUG-3', title: 'Old Mug', price: 990, stock: 9, active: false });
  assert.equal(productPage(store, 'MUG-1'), '<h1>Blue &lt;Mug&gt;</h1>\n<p class="price">€12.90</p>\n<button>Add to cart</button>');
  assert.match(productPage(store, 'MUG-2'), /Sold out/);
  assert.equal(productPage(store, 'MUG-3'), null);
  assert.throws(() => store.put({ sku: 'X', title: 'X', price: 9.5, stock: 1, active: true }), /invalid price/);
});
