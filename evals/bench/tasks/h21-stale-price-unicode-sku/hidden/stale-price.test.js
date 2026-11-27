import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { updatePrice } from '../../src/admin/updatePrice.js';
import { getPrice } from '../../src/api/priceApi.js';
import { createShop } from '../../src/app.js';
import { cartTotal, createCart } from '../../src/cart/cart.js';
import { createPriceCache } from '../../src/pricing/priceCache.js';
import { productPath, renderProductPage, subscribeFromProductPage } from '../../src/web/productPage.js';

const FEED = readFileSync(fileURLToPath(new URL('../../data/supplier-feed.csv', import.meta.url)), 'utf8');

// Same SKUs in the two Unicode forms. Typed on a keyboard = composed (NFC);
// the supplier ERP sends decomposed (NFD) - see data/supplier-feed.csv.
const CAFE_NFC = 'CAFÉ-CRÈME-250';
const CAFE_NFD = 'CAFÉ-CRÈME-250';
const THE_NFC = 'THÉ-VERT-100';
const THE_NFD = 'THÉ-VERT-100';
const SIRUP_NFC = 'CRÈME-BRÛLÉE-SIRUP';
const SIRUP_NFD = 'CRÈME-BRÛLÉE-SIRUP';
const SIRUP_MIXED = 'CRÈME-BRÛLÉE-SIRUP';
const DECAF = 'CAFE-CREME-250'; // a different product (no accents)

function shop() {
  const s = createShop();
  s.importFeed(FEED);
  return s;
}

test('fixture: the feed really carries decomposed SKUs', () => {
  const s = shop();
  assert.equal(s.catalog.get(CAFE_NFC).sku, CAFE_NFD);
  assert.notEqual(CAFE_NFC, CAFE_NFD);
});

test('reported: product page shows the new price right after the admin change', () => {
  const s = shop();
  const path = productPath(s.catalog.get(CAFE_NFC));
  assert.equal(renderProductPage(s, path).price, 'CHF 8.60');
  const res = updatePrice(s, CAFE_NFC, 790);
  assert.equal(res.after, 810);
  const page = renderProductPage(s, path);
  assert.equal(page.price, 'CHF 8.10');
  assert.equal(page.grossCents, 810);
});

test('same cause: a cart line added from the product page is repriced', () => {
  const s = shop();
  const page = renderProductPage(s, productPath(s.catalog.get(CAFE_NFC)));
  const cart = createCart();
  cart.add(page.addToCart.sku, 3);
  assert.equal(cartTotal(s, cart), 2580);
  updatePrice(s, CAFE_NFC, 790);
  assert.equal(cartTotal(s, cart), 2430);
});

test('same cause: POS sees a price changed by the nightly feed', () => {
  const s = shop();
  assert.equal(getPrice(s, THE_NFC).grossCents, 635);
  s.importFeed(`sku;name;price_chf;vat_pct\n${THE_NFD};Thé vert 100g;5.80;2.6\n`);
  assert.equal(getPrice(s, THE_NFC).grossCents, 595);
  assert.equal(getPrice(s, THE_NFD).grossCents, 595);
});

test('same cause: price-drop alerts reach product-page subscribers, once each', () => {
  const s = shop();
  const path = productPath(s.catalog.get(CAFE_NFC));
  assert.equal(subscribeFromProductPage(s, path, 'anna@example.ch').status, 204);
  s.alerts.subscribe('anna@example.ch', CAFE_NFC); // same person again, typed SKU
  s.alerts.subscribe('ben@example.ch', CAFE_NFC);
  assert.equal(s.alerts.subscriberCount(CAFE_NFD), 2);
  assert.equal(s.alerts.subscriberCount(CAFE_NFC), 2);

  const res = updatePrice(s, CAFE_NFC, 790);
  assert.equal(res.notified, 2);
  const to = s.outbox.messages().map((m) => m.to).sort();
  assert.deepEqual(to, ['anna@example.ch', 'ben@example.ch']);
});

test('same cause: the price cache treats canonically equal SKUs as one entry', () => {
  let calls = 0;
  const cache = createPriceCache((p) => {
    calls += 1;
    return p.netCents;
  });
  assert.equal(cache.priceFor(SIRUP_NFD, { netCents: 1150 }), 1150);
  assert.equal(cache.priceFor(SIRUP_NFC, { netCents: 1 }), 1150);
  assert.equal(cache.priceFor(SIRUP_MIXED, { netCents: 2 }), 1150);
  assert.equal(calls, 1);
  assert.equal(cache.invalidate(SIRUP_MIXED), true);
  assert.equal(cache.priceFor(SIRUP_NFD, { netCents: 1090 }), 1090);
  assert.equal(calls, 2);
});

test('guard: accents stay significant - CAFÉ and CAFE are different products', () => {
  const s = shop();
  const accented = productPath(s.catalog.get(CAFE_NFC));
  const decaf = productPath(s.catalog.get(DECAF));
  assert.equal(renderProductPage(s, accented).price, 'CHF 8.60');
  assert.equal(renderProductPage(s, decaf).price, 'CHF 9.15');
  assert.equal(getPrice(s, DECAF).grossCents, 915);
  assert.equal(getPrice(s, CAFE_NFC).grossCents, 860);

  s.alerts.subscribe('decaf@example.ch', DECAF);
  updatePrice(s, CAFE_NFC, 790);
  assert.equal(renderProductPage(s, decaf).price, 'CHF 9.15');
  assert.equal(getPrice(s, DECAF).grossCents, 915);
  assert.equal(s.outbox.messages().length, 0, 'decaf subscriber must not get the CAFÉ alert');
});

test('guard: case/whitespace variants still share one cache entry; page headers unchanged', () => {
  const s = shop();
  const before = s.prices.computes;
  getPrice(s, 'ESP-01');
  getPrice(s, ' esp-01 ');
  getPrice(s, 'Esp-01');
  assert.equal(s.prices.computes - before, 1);
  const page = renderProductPage(s, productPath(s.catalog.get('moulin-01')));
  assert.equal(page.price, 'CHF 52.95');
  assert.equal(page.headers['cache-control'], 'public, max-age=60');
});
