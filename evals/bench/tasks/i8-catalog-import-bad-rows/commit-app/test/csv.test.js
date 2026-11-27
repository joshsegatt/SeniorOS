import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/csv.js';
import { validateProduct } from '../src/validate.js';
import { toCents } from '../src/cents.js';

test('parseCsv honours quotes and escaped quotes', () => {
  const { header, rows } = parseCsv('sku,name\nA,"x, ""y"""\nB,z\n');
  assert.deepEqual(header, ['sku', 'name']);
  assert.deepEqual(rows, [
    { line: 2, fields: ['A', 'x, "y"'] },
    { line: 3, fields: ['B', 'z'] },
  ]);
});

test('toCents', () => {
  assert.equal(toCents('12'), 1200);
  assert.equal(toCents('12.5'), 1250);
  assert.equal(toCents('0.07'), 7);
  assert.equal(toCents('1.234'), null);
  assert.equal(toCents('-1'), null);
});

test('validateProduct rejects a bad price with a reason code', () => {
  assert.throws(
    () => validateProduct({ sku: 'A', name: 'n', description: '', price: 'abc', stock: '1' }, 7),
    (err) => err.reason === 'invalid_price' && err.line === 7,
  );
});
