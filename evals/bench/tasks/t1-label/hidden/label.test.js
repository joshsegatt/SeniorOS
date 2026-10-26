import test from 'node:test';
import assert from 'node:assert/strict';
import { labels } from '../../src/labels.js';
import { renderCheckoutButton, renderEmptyCart } from '../../src/checkout.js';

test('label changed', () => {
  assert.equal(labels.checkoutButton, 'Add to cart');
});

test('rendered button shows the new label', () => {
  assert.match(renderCheckoutButton(), />Add to cart<\/button>$/);
  assert.match(renderCheckoutButton(true), / disabled>/);
});

test('unrelated label untouched', () => {
  assert.equal(renderEmptyCart(), '<p class="empty">Your cart is empty</p>');
});
