import test from 'node:test';
import assert from 'node:assert/strict';
import { productUrl } from '../../src/products.js';
import { imageKey } from '../../src/storage.js';

test('product urls keep accented letters', () => {
  assert.equal(productUrl('Crème brûlée'), '/p/crème-brûlée');
  assert.equal(productUrl('Café au lait!'), '/p/café-au-lait');
  assert.equal(productUrl('Plain Cake'), '/p/plain-cake');
});

test('existing image storage keys do not change', () => {
  assert.equal(imageKey('Crème brûlée'), 'img/cr-me-br-l-e.jpg');
  assert.equal(imageKey('Café au lait!'), 'img/caf-au-lait.jpg');
  assert.equal(imageKey('Plain Cake'), 'img/plain-cake.jpg');
});
