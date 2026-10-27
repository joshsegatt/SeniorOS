import test from 'node:test';
import assert from 'node:assert/strict';
import { labels } from '../src/labels.js';
import { renderCheckoutButton } from '../src/checkout.js';

test('checkout button label', () => {
  assert.equal(labels.checkoutButton, 'Buy now');
});

test('renders the checkout button', () => {
  assert.match(renderCheckoutButton(), /Buy now<\/button>$/);
});
