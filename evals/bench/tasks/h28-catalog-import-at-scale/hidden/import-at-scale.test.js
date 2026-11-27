import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { importCatalog } from '../../src/index.js';

// Import time budget for the large files, measured inside a worker around the
// importCatalog() call only. The correct linear import takes well under a
// second on a laptop; the budget leaves a wide margin for slow CI machines.
const BUDGET_MS = 6000;

// Deterministic supplier file + the result the contract in
// docs/import-format.md requires for it. Self-contained: it is also shipped to
// a worker as source text.
function generateCatalog({ n, seed, crlf = false, existingEvery = 3 }) {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const EOL = crlf ? '\r\n' : '\n';
  const columns = ['description', 'sku', 'price', 'name', 'currency', 'stock'];
  const unique = Math.floor(n * 0.85);
  const skuOf = (k) => `SKU-${k.toString(36).toUpperCase().padStart(5, '0')}`;

  const existing = [];
  for (let k = 0; k < unique; k += existingEvery) existing.push({ sku: skuOf(k), name: `old ${k}` });
  const existingSkus = new Set(existing.map((p) => p.sku));

  const parts = ['﻿' + columns.map((c) => (c === 'sku' ? 'SKU' : c)).join(',') + EOL];
  let line = 2;
  const errors = [];
  const slots = [];
  const slotBySku = new Map();
  let duplicates = 0;

  for (let i = 0; i < n; i++) {
    const k = i < unique ? i : Math.floor(random() * unique);
    const sku = skuOf(k);
    let description;
    let descriptionValue;
    if (i % 5 === 0) {
      description = `"Line one of ${i}${EOL}line two, with comma${EOL}and a ""quote"""`;
      descriptionValue = `Line one of ${i}${EOL}line two, with comma${EOL}and a "quote"`;
    } else if (i % 7 === 0) {
      description = `"short, ${i}"`;
      descriptionValue = `short, ${i}`;
    } else {
      description = `plain ${i}`;
      descriptionValue = description;
    }
    let price = `${(i % 500) + 1}.${String(i % 100).padStart(2, '0')}`;
    let bad = null;
    if (i % 97 === 13) {
      price = `${i}.125`;
      bad = 'price';
    } else if (i % 211 === 7) {
      bad = 'fields';
    } else if (i % 389 === 100) {
      bad = 'sku';
    }
    const values = {
      description,
      sku: bad === 'sku' ? '' : sku,
      price,
      name: `Product ${i}`,
      currency: ['CHF', 'EUR', 'USD'][i % 3],
      stock: i % 11 === 0 ? '' : String(i % 50),
    };
    let record = columns.map((c) => values[c]).join(',');
    if (bad === 'fields') record += ',extra';
    parts.push(record + EOL);

    const startLine = line;
    line += 1 + (description.split('\n').length - 1);
    if (bad === 'fields') errors.push([startLine, null]);
    else if (bad === 'sku') errors.push([startLine, null]);
    else if (bad === 'price') errors.push([startLine, sku]);
    else {
      const product = [
        sku,
        startLine,
        existingSkus.has(sku) ? 'update' : 'create',
        ((i % 500) + 1) * 100 + (i % 100),
        `Product ${i}`,
        i % 11 === 0 ? 0 : i % 50,
        descriptionValue,
      ];
      const previous = slotBySku.get(sku);
      if (previous !== undefined) {
        slots[previous] = null;
        duplicates++;
      }
      slotBySku.set(sku, slots.length);
      slots.push(product);
    }
    if (i % 1000 === 999) {
      parts.push(EOL);
      line += 1;
    }
    if (i % 4000 === 1234) {
      parts.push(EOL + EOL);
      line += 2;
    }
  }

  const products = slots.filter((p) => p !== null);
  const stats = {
    created: products.filter((p) => p[2] === 'create').length,
    updated: products.filter((p) => p[2] === 'update').length,
    duplicates,
    errors: errors.length,
  };
  return { text: parts.join(''), existing, expected: { products, errors, stats } };
}

function project(result) {
  return {
    products: result.products.map((p) => [p.sku, p.line, p.action, p.priceCents, p.name, p.stock, p.description]),
    errors: result.errors.map((e) => [e.line, e.sku]),
    stats: result.stats,
  };
}

function assertSameResult(actual, expected) {
  assert.deepEqual(actual.stats, expected.stats, 'stats');
  assert.equal(actual.errors.length, expected.errors.length, 'number of errors');
  for (let i = 0; i < expected.errors.length; i++) {
    if (actual.errors[i][0] !== expected.errors[i][0] || actual.errors[i][1] !== expected.errors[i][1]) {
      assert.fail(`error #${i}: expected line ${expected.errors[i][0]} sku ${expected.errors[i][1]}, got line ${actual.errors[i][0]} sku ${actual.errors[i][1]}`);
    }
  }
  assert.equal(actual.products.length, expected.products.length, 'number of products');
  for (let i = 0; i < expected.products.length; i++) {
    const a = actual.products[i];
    const e = expected.products[i];
    if (a.length !== e.length || a.some((v, j) => v !== e[j])) {
      assert.fail(`product #${i}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
    }
  }
}

function importInWorker(options) {
  const code = `
    const { parentPort, workerData } = require('node:worker_threads');
    (async () => {
      const { importCatalog } = await import(workerData.src);
      const generateCatalog = new Function('return (' + workerData.generator + ')')();
      const { text, existing } = generateCatalog(workerData.options);
      parentPort.postMessage({ started: true });
      const t0 = performance.now();
      const result = importCatalog(text, { existing });
      const ms = performance.now() - t0;
      parentPort.postMessage({
        ms,
        products: result.products.map((p) => [p.sku, p.line, p.action, p.priceCents, p.name, p.stock, p.description]),
        errors: result.errors.map((e) => [e.line, e.sku]),
        stats: result.stats,
      });
    })().catch((err) => parentPort.postMessage({ failure: String((err && err.stack) || err) }));
  `;
  return new Promise((resolve, reject) => {
    const worker = new Worker(code, {
      eval: true,
      // Same stack as the main thread of the admin server that runs the import.
      resourceLimits: { stackSizeMb: 1 },
      workerData: { src: new URL('../../src/index.js', import.meta.url).href, generator: generateCatalog.toString(), options },
    });
    let timer = null;
    const finish = (fn) => {
      clearTimeout(timer);
      worker.terminate();
      fn();
    };
    worker.on('message', (msg) => {
      if (msg.started) {
        timer = setTimeout(
          () => finish(() => reject(new Error(`import of ${options.n} rows still running after ${BUDGET_MS + 5000}ms`))),
          BUDGET_MS + 5000,
        );
      } else if (msg.failure) {
        finish(() => reject(new Error(`import threw: ${msg.failure}`)));
      } else {
        finish(() => resolve(msg));
      }
    });
    worker.on('error', (err) => finish(() => reject(err)));
  });
}

// ---------------------------------------------------------------- exact contract on small files

test('small LF file: order, duplicates, line numbers with multi-line values and blank lines', () => {
  const { text, existing, expected } = generateCatalog({ n: 60, seed: 1 });
  assert.ok(expected.stats.duplicates > 0 && expected.errors.length > 0);
  assertSameResult(project(importCatalog(text, { existing })), expected);
});

test('small CRLF file: same contract', () => {
  const { text, existing, expected } = generateCatalog({ n: 80, seed: 2, crlf: true });
  assertSameResult(project(importCatalog(text, { existing })), expected);
});

test('hand-written file: a duplicate keeps the position of its last valid row', () => {
  const csv = [
    'sku,name,price,currency,stock,description',
    'A-100,Chair,10,CHF,1,"first',
    'still the chair"',
    'B-200,Table,5,CHF,1,',
    '',
    'A-100,Chair v2,11,CHF,1,',
    'C-300,Lamp,7,CHF,1,',
    'B-200,Table v2,oops,CHF,1,',
    'D-400,Shelf,9,CHF,1,"x',
    '',
    'y"',
    'A-100,Chair v3,12,CHF,1,',
    'E-500,Bin,3,CHF,1,',
  ].join('\n');
  const { products, errors, stats } = importCatalog(csv);
  assert.deepEqual(products.map((p) => [p.sku, p.name, p.line]), [
    ['B-200', 'Table', 4],
    ['C-300', 'Lamp', 7],
    ['D-400', 'Shelf', 9],
    ['A-100', 'Chair v3', 12],
    ['E-500', 'Bin', 13],
  ]);
  assert.deepEqual(errors, [{ line: 8, sku: 'B-200', message: 'invalid price "oops"' }]);
  assert.deepEqual(stats, { created: 5, updated: 0, duplicates: 2, errors: 1 });
});

// ---------------------------------------------------------------- scale

test('200,000-row file imports within the budget with the exact result', async () => {
  const options = { n: 200_000, seed: 3 };
  const run = importInWorker(options);
  const { expected } = generateCatalog(options);
  const result = await run;
  assert.ok(result.ms <= BUDGET_MS, `import took ${Math.round(result.ms)}ms (budget ${BUDGET_MS}ms)`);
  assertSameResult(result, expected);
});

test('120,000-row CRLF file against 51,000 existing products within the budget', async () => {
  const options = { n: 120_000, seed: 4, crlf: true, existingEvery: 2 };
  const run = importInWorker(options);
  const { expected } = generateCatalog(options);
  const result = await run;
  assert.ok(result.ms <= BUDGET_MS, `import took ${Math.round(result.ms)}ms (budget ${BUDGET_MS}ms)`);
  assertSameResult(result, expected);
});
