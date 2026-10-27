import test from 'node:test';
import assert from 'node:assert/strict';
import { priceWithTax } from '../../src/pricing.js';

// Bonus: the refactor also silently dropped the unknown-region error. Reading the diff finds it.
test('unknown region still throws', () => {
  assert.throws(() => priceWithTax(10000, 'XX'));
});
