import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updatePrice } from '../src/admin/updatePrice.js';
import { getPrice } from '../src/api/priceApi.js';
import { cartTotal, createCart } from '../src/cart/cart.js';
import { productPath, renderProductPage, subscribeFromProductPage } from '../src/web/productPage.js';
import { shopWithFeed } from './helpers.js';

test('product page shows the gross price', () => {
  const shop = shopWithFeed();
  const page = renderProductPage(shop, productPath(shop.catalog.get('ESP-01')));
  assert.equal(page.status, 200);
  assert.equal(page.title, 'Espresso Bohnen 1kg');
  assert.equal(page.price, 'CHF 25.55');
  assert.equal(page.headers['cache-control'], 'public, max-age=60');
  assert.equal(renderProductPage(shop, '/p/NOPE').status, 404);
});

test('admin price change shows up on the product page, cart and POS', () => {
  const shop = shopWithFeed();
  const path = productPath(shop.catalog.get('ESP-01'));
  const cart = createCart();
  cart.add('ESP-01', 2);
  assert.equal(renderProductPage(shop, path).price, 'CHF 25.55');
  assert.equal(cartTotal(shop, cart), 5110);

  const res = updatePrice(shop, 'esp-01', 2290);
  assert.deepEqual([res.before, res.after], [2555, 2350]);
  assert.equal(renderProductPage(shop, path).price, 'CHF 23.50');
  assert.equal(cartTotal(shop, cart), 4700);
  assert.equal(getPrice(shop, 'ESP-01').price, 'CHF 23.50');
});

test('price drop notifies subscribers once; a raise notifies nobody', () => {
  const shop = shopWithFeed();
  const path = productPath(shop.catalog.get('moulin-01'));
  subscribeFromProductPage(shop, path, 'anna@example.ch');
  subscribeFromProductPage(shop, path, ' Anna@Example.ch ');
  assert.equal(updatePrice(shop, 'MOULIN-01', 5200).notified, 0);
  assert.equal(updatePrice(shop, 'MOULIN-01', 4500).notified, 1);
  const mails = shop.outbox.messages();
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'anna@example.ch');
  assert.match(mails[0].subject, /Moulin/);
});

test('feed re-import updates prices', () => {
  const shop = shopWithFeed();
  assert.equal(getPrice(shop, 'FILTER-102').grossCents, 345);
  shop.importFeed('sku;name;price_chf;vat_pct\nFILTER-102;Filtertüten Gr. 102 (100 Stk);2.90;8.1\n');
  assert.equal(getPrice(shop, 'FILTER-102').grossCents, 315);
  assert.equal(getPrice(shop, 'NOPE').status, 404);
});
