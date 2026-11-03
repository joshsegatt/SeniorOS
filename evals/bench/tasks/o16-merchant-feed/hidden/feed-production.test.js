// Runs under the configuration the app ships with: src/main.js starts with APP_ENV=production.
process.env.APP_ENV = 'production';

const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { config } = await import('../../src/config.js');
const { createProductStore } = await import('../../src/catalog/products.js');
const { merchantFeed } = await import('../../src/feeds/merchant.js');

/** @param {string} tsv */
function parse(tsv) {
  const [header, ...rows] = tsv.split(/\r?\n/).filter((l) => l !== '').map((l) => l.split('\t'));
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i]])));
}

/** "1500 JPY" → { amount: 1500, currency: 'JPY' } */
function price(cell) {
  const m = /^\s*([0-9]+(?:\.[0-9]+)?)\s+([A-Z]{3})\s*$/.exec(cell ?? '');
  assert.ok(m, `price "${cell}" is not "<amount> <ISO code>"`);
  return { amount: Number(m[1]), currency: m[2] };
}

function store() {
  const s = createProductStore();
  s.put({ sku: 'YUN-1', title: 'Yunomi tea cup', price: 1500, stock: 4, active: true });
  s.put({ sku: 'DON-2', title: 'Donburi bowl', price: 3980, stock: 0, active: true });
  s.put({ sku: 'OLD-3', title: 'Old plate', price: 800, stock: 2, active: false });
  return s;
}

test('the shipped config is the one under test', () => {
  assert.equal(config.shop.currency, 'JPY');
});

test('production feed prices are the real prices in the shop currency', async () => {
  const rows = parse(await merchantFeed(store()));
  assert.deepEqual(rows.map((r) => r.id), ['YUN-1', 'DON-2']);
  assert.deepEqual(price(rows[0].price), { amount: 1500, currency: 'JPY' });
  assert.deepEqual(price(rows[1].price), { amount: 3980, currency: 'JPY' });
});

test('production feed links point at the production shop', async () => {
  const rows = parse(await merchantFeed(store()));
  assert.equal(rows[0].link, 'https://kiosk-ceramics.example.jp/p/YUN-1');
  assert.equal(rows[0].availability, 'in_stock');
  assert.equal(rows[1].availability, 'out_of_stock');
});
