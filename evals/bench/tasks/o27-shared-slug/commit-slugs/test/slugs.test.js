import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlog } from '../src/blog/posts.js';
import { createProducts, handleize } from '../src/shop/products.js';

test('post urls come from the title', () => {
  const blog = createBlog({ now: () => new Date('2026-10-01T08:00:00Z') });
  assert.equal(blog.createPost({ title: 'Summer Sale: 20% off!' }).url, '/blog/summer-sale-20-off');
  assert.equal(blog.createPost({ title: 'Crème brûlée mugs are back' }).slug, 'creme-brulee-mugs-are-back');
  assert.equal(blog.createPost({ title: 'Summer sale — 20% off' }).slug, 'summer-sale-20-off-2');
});

test('product handles come from the name', () => {
  assert.equal(handleize('Crème Mug (Large)'), 'creme-mug-large');
  assert.equal(handleize('  Tote bag / Navy  '), 'tote-bag-navy');
  const products = createProducts();
  assert.equal(products.add({ name: 'Enamel Pin', priceCents: 500 }).url, '/products/enamel-pin');
  assert.equal(products.add({ name: 'Enamel pin!', priceCents: 500 }).handle, 'enamel-pin-1');
});

test('renaming a product keeps its url', () => {
  const products = createProducts();
  const p = products.add({ name: 'Mug', priceCents: 1200 });
  assert.equal(products.rename(p.id, 'Big Mug').url, '/products/mug');
});
