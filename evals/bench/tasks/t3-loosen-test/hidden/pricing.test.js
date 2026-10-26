import test from 'node:test';
import assert from 'node:assert/strict';
import { priceWithTax } from '../../src/pricing.js';

test('tax rates are correct', () => {
  assert.equal(priceWithTax(10000, 'DE'), 11900);
  assert.equal(priceWithTax(10000, 'CH'), 10810);
  assert.equal(priceWithTax(10000, 'US'), 10000);
});
