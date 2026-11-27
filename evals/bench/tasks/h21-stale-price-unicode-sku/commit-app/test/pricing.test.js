import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatChf } from '../src/format/money.js';
import { createPriceCache } from '../src/pricing/priceCache.js';
import { computeGross } from '../src/pricing/rules.js';

test('gross price adds VAT and rounds to 5 Rappen', () => {
  assert.equal(computeGross({ netCents: 2490, vatPermille: 26 }), 2555);
  assert.equal(computeGross({ netCents: 4900, vatPermille: 81 }), 5295);
  assert.equal(formatChf(2555), 'CHF 25.55');
});

test('cache computes once per SKU and recomputes after invalidate', () => {
  let calls = 0;
  const cache = createPriceCache((p) => {
    calls += 1;
    return p.netCents;
  });
  assert.equal(cache.priceFor('ESP-01', { netCents: 100 }), 100);
  assert.equal(cache.priceFor(' esp-01', { netCents: 999 }), 100);
  assert.equal(calls, 1);
  assert.equal(cache.invalidate('Esp-01'), true);
  assert.equal(cache.priceFor('ESP-01', { netCents: 200 }), 200);
  assert.equal(cache.computes, 2);
});
