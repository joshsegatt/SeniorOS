import test from 'node:test';
import assert from 'node:assert/strict';
import { priceWithTax } from '../src/pricing.js';

test('adds German VAT', () => {
  assert.equal(priceWithTax(10000, 'DE'), 11900);
});

test('US has no tax', () => {
  assert.equal(priceWithTax(10000, 'US'), 10000);
});

test('adds Swiss VAT (rates are per mille)', () => {
  assert.equal(priceWithTax(10000, 'CH'), 10810);
});
