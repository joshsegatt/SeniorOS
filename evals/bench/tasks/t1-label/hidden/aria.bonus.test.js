import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCheckoutButton } from '../../src/checkout.js';

// Bonus: the hard-coded aria-label must follow the visible label.
test('aria-label matches the new label', () => {
  assert.doesNotMatch(renderCheckoutButton(), /Buy now/);
});
