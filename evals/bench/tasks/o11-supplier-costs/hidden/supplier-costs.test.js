import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createCatalog } from '../../src/catalog/catalog.js';
import { demoProducts } from '../../src/catalog/seed.js';
import { applySupplierCosts } from '../../src/catalog/supplier-costs.js';

test('the sample price list updates the products we stock and lists the rest', async () => {
  const catalog = createCatalog(demoProducts(100));
  const csv = readFileSync(new URL('../../data/supplier-costs-sample.csv', import.meta.url), 'utf8');
  const result = await applySupplierCosts(csv, catalog);
  assert.equal(result.updated, 5);
  assert.deepEqual(result.unknown.map((s) => s.trim().toUpperCase()), ['XYZ-99001']);
  assert.equal(catalog.findBySku('MUG-00001').costCents, 215);
  assert.equal(catalog.findBySku('TEA-00002').costCents, 680);
  assert.equal(catalog.findBySku('GLA-00005').costCents, 95);
  assert.equal(catalog.findBySku('MUG-00009').costCents, null);
});

test('category margins reflect the new costs', async () => {
  const catalog = createCatalog([
    { sku: 'MUG-1', name: 'Mug', category: 'mugs', priceCents: 1000, costCents: null },
    { sku: 'MUG-2', name: 'Big mug', category: 'mugs', priceCents: 2000, costCents: 500 },
  ]);
  const result = await applySupplierCosts('sku;description;cost_eur\nMUG-1;Mug;6,00\nMUG-2;Big mug;10,00\n', catalog);
  assert.equal(result.updated, 2);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(catalog.categoryStats('mugs'), { products: 2, withCost: 2, avgMarginPct: 45 });
});

test('a full price list for the production-size catalog applies in seconds', () => {
  const catalogUrl = new URL('../../src/catalog/catalog.js', import.meta.url).href;
  const costsUrl = new URL('../../src/catalog/supplier-costs.js', import.meta.url).href;
  const seedUrl = new URL('../../src/catalog/seed.js', import.meta.url).href;
  const script = `
    const { createCatalog } = await import(${JSON.stringify(catalogUrl)});
    const { applySupplierCosts } = await import(${JSON.stringify(costsUrl)});
    const { demoProducts } = await import(${JSON.stringify(seedUrl)});
    const products = demoProducts(40000);
    const catalog = createCatalog(products);
    const lines = ['sku;description;cost_eur'];
    for (let i = 0; i < products.length; i += 1) {
      if (i % 40 === 0) continue;
      const cost = Math.floor(products[i].priceCents * 0.4);
      lines.push(products[i].sku + ';' + products[i].name + ';' + Math.floor(cost / 100) + ',' + String(cost % 100).padStart(2, '0'));
    }
    for (let i = 0; i < 300; i += 1) lines.push('OLD-' + String(i).padStart(5, '0') + ';gone;1,00');
    const started = Date.now();
    const result = await applySupplierCosts(lines.join('\\n') + '\\n', catalog);
    const ms = Date.now() - started;
    const mugs = catalog.categoryStats('mugs');
    process.stdout.write(JSON.stringify({ updated: result.updated, unknown: result.unknown.length, ms, mugs,
      cost: catalog.findBySku(products[39998].sku).costCents, missing: catalog.findBySku(products[40].sku).costCents }));
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 3000 });
  assert.ok(!run.error && run.signal === null, `40k-row price list did not apply within 3 s (killed: ${run.signal ?? run.error?.message})`);
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.equal(out.updated, 39000);
  assert.equal(out.unknown, 300);
  assert.equal(out.mugs.products, 5000);
  assert.equal(out.mugs.withCost, 5000 - 1000);
  assert.equal(out.cost, Math.floor((500 + ((39998 * 37) % 4500)) * 0.4));
  assert.equal(out.missing, null);
});
