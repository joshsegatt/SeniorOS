import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createBlog } from '../../src/blog/posts.js';
import { createProducts, handleize } from '../../src/shop/products.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('one shared slugify in src/lib/slug.js, used by posts and products', async () => {
  assert.ok(existsSync(new URL('../../src/lib/slug.js', import.meta.url)), 'src/lib/slug.js exists');
  const lib = await import('../../src/lib/slug.js');
  assert.equal(typeof lib.slugify, 'function');
  for (const file of ['src/blog/posts.js', 'src/shop/products.js']) {
    const text = src(file);
    assert.match(text, /from\s+['"]\.\.\/lib\/slug\.js['"]/, `${file} imports the shared slugify`);
    assert.doesNotMatch(text, /normalize\(\s*['"]NFKD['"]\s*\)/, `${file} no longer has its own copy`);
  }
});

test('blog posts keep today\'s slugs', () => {
  const blog = createBlog({ now: () => new Date('2026-10-01T08:00:00Z') });
  const cases = [
    ['Summer Sale: 20% off!', 'summer-sale-20-off'],
    ['BBQ_Grill season starts', 'bbq-grill-season-starts'],
    ['__init__ tips for print_on_demand', 'init-tips-for-print-on-demand'],
    ['How we pack 10,000 orders a month without losing our minds or our tape guns', 'how-we-pack-10-000-orders-a-month-without-losing-our-minds-or-our-tape-guns'],
    ['Inside the workshop: screen printing, embroidery and every other trick behind our merch', 'inside-the-workshop-screen-printing-embroidery-and-every-other-trick-behind-our'],
    ['Ten things you never knew about enamel pins — and the factory where we make ours', 'ten-things-you-never-knew-about-enamel-pins-and-the-factory-where-we-make-ours'],
  ];
  for (const [title, slug] of cases) assert.equal(blog.createPost({ title }).url, `/blog/${slug}`, title);
});

test('products keep today\'s handles', () => {
  const cases = [
    ['Crème Mug (Large)', 'creme-mug-large'],
    ['BBQ_Grill Cover — Heavy Duty', 'bbq_grill-cover-heavy-duty'],
    ['mug_v2 (15 oz)', 'mug_v2-15-oz'],
    ['Ultra Light Trekking Backpack 45 Litre Waterproof With Rain Cover', 'ultra-light-trekking-backpack-45-litre-waterproof-with-rain-'],
    ['Organic Cotton Hoodie, Unisex, Heather Grey - Limited Edition Print', 'organic-cotton-hoodie-unisex-heather-grey-limited-edition-pr'],
  ];
  const products = createProducts();
  for (const [name, handle] of cases) {
    assert.equal(handleize(name), handle, name);
    assert.equal(products.add({ name, priceCents: 1000 }).url, `/products/${handle}`, name);
  }
});

test('a product whose old handle exists still gets the same suffix', () => {
  const products = createProducts();
  products.add({ name: 'mug_v2', priceCents: 1000 });
  assert.equal(products.add({ name: 'MUG_V2', priceCents: 1000 }).handle, 'mug_v2-1');
  assert.equal(products.byHandle('mug_v2')?.name, 'mug_v2');
});
