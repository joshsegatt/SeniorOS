import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateFor, taxOn } from '../src/tax.js';
import { roundHalfUp } from '../src/money.js';

test('rates per country in basis points', () => {
  assert.equal(rateFor('CH'), 810);
  assert.equal(rateFor('DE'), 1900);
  assert.throws(() => rateFor('XX'), RangeError);
});

test('tax rounds half up to the cent', () => {
  assert.equal(taxOn(1850, 810), 150); // 149.85
  assert.equal(taxOn(10000, 810), 810);
  assert.equal(taxOn(0, 2000), 0);
});

test('roundHalfUp sends ties away from zero', () => {
  assert.equal(roundHalfUp(5, 10), 1);
  assert.equal(roundHalfUp(4, 10), 0);
  assert.equal(roundHalfUp(-5, 10), -1);
});
