import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importProducts } from '../../src/importer.js';
import { Catalog } from '../../src/catalog.js';

const brief = (errors) => (errors ?? []).map((e) => ({ line: e.line, reason: e.reason }));

function run(text, catalog = new Catalog()) {
  const result = importProducts(text, { catalog });
  assert.ok(result && typeof result === 'object', 'importProducts must return a result object');
  assert.ok(Array.isArray(result.errors), 'result.errors must list the rejected rows');
  return { result, catalog };
}

test('every valid row is imported and every bad row is reported with line and reason', () => {
  const text = [
    'sku,name,description,price,stock', //            1
    'A-1,Hammer,Steel hammer,12.50,10', //            2
    'A-2,Saw,,abc,5', //                              3 invalid_price
    'A-3,Drill,"Cordless, 18V",89.90,3', //           4
    ',Nameless,,1.00,1', //                           5 missing_sku
    'A-5,Glue,,2.5,-1', //                            6 invalid_stock
    'A-6,Tape,,1.20,7', //                            7
    'A-7,Box,,1.00', //                               8 column_count
    'A-8,,,3.00,1', //                                9 missing_name
    'A-9,Pliers,,7.999,2', //                         10 invalid_price
    ',,,nope,x', //                                   11 missing_sku (first rule wins)
    'A-10,Level,"60 cm, ""pro""",15,1', //            12
    '',
  ].join('\n');
  const { result, catalog } = run(text);

  assert.equal(result.imported, 4);
  assert.deepEqual(
    catalog.all().map((p) => p.sku).sort(),
    ['A-1', 'A-10', 'A-3', 'A-6'],
  );
  assert.deepEqual(catalog.get('A-3'), {
    sku: 'A-3', name: 'Drill', description: 'Cordless, 18V', priceCents: 8990, stock: 3,
  });
  assert.equal(catalog.get('A-10').description, '60 cm, "pro"');
  assert.deepEqual(brief(result.errors), [
    { line: 3, reason: 'invalid_price' },
    { line: 5, reason: 'missing_sku' },
    { line: 6, reason: 'invalid_stock' },
    { line: 8, reason: 'column_count' },
    { line: 9, reason: 'missing_name' },
    { line: 10, reason: 'invalid_price' },
    { line: 11, reason: 'missing_sku' },
  ]);
  const a2 = result.errors.find((e) => e.line === 3);
  assert.equal(a2.sku, 'A-2');
  for (const e of result.errors) {
    assert.equal(typeof e.message, 'string');
    assert.ok(e.message.length > 0, `line ${e.line}: message must say why`);
  }
});

test('Excel export: BOM, CRLF, blank lines and line breaks inside quoted descriptions', () => {
  const text =
    '﻿sku,name,description,price,stock\r\n' + //               1
    'B-1,Lamp,"Desk lamp\r\nwith ""warm"" light, 40W",10.00,4\r\n' + // 2-3
    'B-2,Bulb,LED,x,1\r\n' + //                                       4 invalid_price
    '\r\n' + //                                                      5 blank
    'B-3,Plug,"Type J, 3 pins",3.10,12\r\n' + //                    6
    'B-4,Cable,"2m\r\nblack",4.00,2.5\r\n' + //                     7-8 invalid_stock
    'B-5,Fuse,Spare,1.00,1\r\n'; //                                  9
  const { result, catalog } = run(text);

  assert.equal(result.imported, 3);
  assert.deepEqual(catalog.all().map((p) => p.sku).sort(), ['B-1', 'B-3', 'B-5']);
  const lamp = catalog.get('B-1');
  assert.ok(lamp.description.startsWith('Desk lamp'));
  assert.ok(lamp.description.endsWith('with "warm" light, 40W'));
  assert.equal(lamp.priceCents, 1000);
  assert.equal(lamp.stock, 4);
  assert.equal(catalog.get('B-3').stock, 12);
  assert.equal(catalog.get('B-5').description, 'Spare');
  assert.equal(catalog.get('B-5').stock, 1);
  assert.deepEqual(brief(result.errors), [
    { line: 4, reason: 'invalid_price' },
    { line: 7, reason: 'invalid_stock' },
  ]);
});

test('duplicate sku: first valid row wins, later one is reported', () => {
  const text = [
    'sku,name,description,price,stock', // 1
    'C-1,First,,1.00,1', //                2
    'C-2,Bad,,-1,1', //                    3 invalid_price
    'C-2,Good,,2.00,1', //                 4 imported: the earlier C-2 was rejected
    'C-1,Second,,9.00,9', //               5 duplicate_sku
  ].join('\n');
  const { result, catalog } = run(text);

  assert.equal(result.imported, 2);
  assert.equal(catalog.get('C-1').name, 'First');
  assert.equal(catalog.get('C-2').name, 'Good');
  assert.deepEqual(brief(result.errors), [
    { line: 3, reason: 'invalid_price' },
    { line: 5, reason: 'duplicate_sku' },
  ]);
  assert.equal(result.errors[1].sku, 'C-1');
});

test('columns in any order; a rejected row never changes the catalog', () => {
  const catalog = new Catalog();
  catalog.upsert({ sku: 'D-1', name: 'Keep', description: '', priceCents: 500, stock: 2 });
  catalog.upsert({ sku: 'D-2', name: 'Old', description: '', priceCents: 100, stock: 1 });
  const text = [
    'stock,price,sku,name,description', // 1
    '3,abc,D-1,Broken,', //               2 invalid_price
    '8,2.20,D-2,New,"two\nlines"', //     3-4
    '1,1.00,D-3,Third,ok', //             5
  ].join('\n');
  const { result } = run(text, catalog);

  assert.equal(result.imported, 2);
  assert.deepEqual(catalog.get('D-1'), { sku: 'D-1', name: 'Keep', description: '', priceCents: 500, stock: 2 });
  assert.equal(catalog.get('D-2').name, 'New');
  assert.equal(catalog.get('D-2').priceCents, 220);
  assert.equal(catalog.get('D-3').stock, 1);
  assert.deepEqual(brief(result.errors), [{ line: 2, reason: 'invalid_price' }]);
});

test('a clean file reports no errors', () => {
  const { result } = run('sku,name,description,price,stock\r\nE-1,One,,1,1\r\nE-2,Two,,2.05,0\r\n');
  assert.equal(result.imported, 2);
  assert.deepEqual(result.errors, []);
});
