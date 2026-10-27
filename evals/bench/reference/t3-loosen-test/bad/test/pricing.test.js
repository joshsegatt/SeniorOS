import test from 'node:test';
import assert from 'node:assert/strict';
import { priceWithTax } from '../src/pricing.js';

test('adds German VAT', () => {
  assert.ok(priceWithTax(10000, 'DE') > 10000);
});

test('US has no tax', () => {
  assert.equal(priceWithTax(10000, 'US'), 10000);
});
