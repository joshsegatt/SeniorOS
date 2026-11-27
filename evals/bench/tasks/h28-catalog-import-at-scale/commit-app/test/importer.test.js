import test from 'node:test';
import assert from 'node:assert/strict';
import { importCatalog, ImportError, formatReport } from '../src/index.js';

const HEADER = 'sku,name,price,currency,stock,description';

test('imports valid rows in file order', () => {
  const csv = [HEADER, 'A-100,Chair,49.9,CHF,3,Oak', 'B-200,Table,120,EUR,,'].join('\n');
  const { products, errors, stats } = importCatalog(csv);
  assert.deepEqual(errors, []);
  assert.deepEqual(products, [
    { sku: 'A-100', name: 'Chair', priceCents: 4990, currency: 'CHF', stock: 3, description: 'Oak', line: 2, action: 'create' },
    { sku: 'B-200', name: 'Table', priceCents: 12000, currency: 'EUR', stock: 0, description: '', line: 3, action: 'create' },
  ]);
  assert.deepEqual(stats, { created: 2, updated: 0, duplicates: 0, errors: 0 });
});

test('reports rejected rows with their line', () => {
  const csv = [HEADER, 'A-100,Chair,49.9,CHF,3,', 'B-200,Table,12.345,EUR,1,', ',Nameless,1,CHF,1,', 'C-300,Lamp,5,GBP,1,', 'D-400,Shelf,5,CHF'].join('\n');
  const { products, errors } = importCatalog(csv);
  assert.deepEqual(products.map((p) => p.sku), ['A-100']);
  assert.deepEqual(errors, [
    { line: 3, sku: 'B-200', message: 'invalid price "12.345"' },
    { line: 4, sku: null, message: 'missing sku' },
    { line: 5, sku: 'C-300', message: 'invalid currency "GBP"' },
    { line: 6, sku: null, message: 'expected 6 fields, got 4' },
  ]);
});

test('columns can come in any order, names are case-insensitive', () => {
  const csv = 'Price,SKU,Currency,Name\n9.5,X-1,usd,Mug\n';
  const { products } = importCatalog(csv);
  assert.equal(products[0].sku, 'X-1');
  assert.equal(products[0].priceCents, 950);
  assert.equal(products[0].currency, 'USD');
  assert.equal(products[0].stock, 0);
});

test('quoted values with commas', () => {
  const csv = `${HEADER}\nA-100,"Chair, oak",10,CHF,1,"big, brown"\n`;
  const { products } = importCatalog(csv);
  assert.equal(products[0].name, 'Chair, oak');
  assert.equal(products[0].description, 'big, brown');
});

test('a SKU repeated on the next row: the later row wins', () => {
  const csv = [HEADER, 'A-100,Chair,10,CHF,1,', 'A-100,Chair v2,11,CHF,1,', 'B-200,Table,5,CHF,1,'].join('\n');
  const { products, stats } = importCatalog(csv);
  assert.deepEqual(products.map((p) => [p.sku, p.name, p.line]), [['A-100', 'Chair v2', 3], ['B-200', 'Table', 4]]);
  assert.equal(stats.duplicates, 1);
});

test('existing SKUs become updates', () => {
  const csv = [HEADER, 'A-100,Chair,10,CHF,1,', 'B-200,Table,5,CHF,1,'].join('\n');
  const { products, stats } = importCatalog(csv, { existing: [{ sku: 'B-200' }] });
  assert.deepEqual(products.map((p) => p.action), ['create', 'update']);
  assert.deepEqual(stats, { created: 1, updated: 1, duplicates: 0, errors: 0 });
});

test('file-level problems throw ImportError', () => {
  assert.throws(() => importCatalog(''), ImportError);
  assert.throws(() => importCatalog('sku,name,price\nA-1,x,1\n'), /missing column\(s\): currency/);
  assert.throws(() => importCatalog(`${HEADER}\nA-100,"Chair,10,CHF,1,\n`), /line 2: unterminated/);
});

test('report summary', () => {
  const csv = [HEADER, 'A-100,Chair,10,CHF,1,', 'B-200,Table,x,CHF,1,'].join('\n');
  assert.equal(
    formatReport(importCatalog(csv)),
    '1 created, 0 updated, 0 duplicate rows, 1 rejected\n  line 3 (B-200): invalid price "x"',
  );
});
