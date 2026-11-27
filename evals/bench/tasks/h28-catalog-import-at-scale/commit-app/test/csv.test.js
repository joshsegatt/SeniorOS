import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, CsvError } from '../src/csv.js';

test('splits fields and records', () => {
  assert.deepEqual(parseCsv('a,b,c\n1,2,3\n'), [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('accepts CRLF and a missing final line break', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('quoted values keep commas, quotes and line breaks', () => {
  assert.deepEqual(parseCsv('x,y\n"a,b","say ""hi""\nbye"\n'), [['x', 'y'], ['a,b', 'say "hi"\nbye']]);
});

test('empty fields and empty lines', () => {
  assert.deepEqual(parseCsv('a,,c\n\n,,\n'), [['a', '', 'c'], [''], ['', '', '']]);
});

test('ignores a UTF-8 BOM', () => {
  assert.deepEqual(parseCsv('﻿sku\nA1\n'), [['sku'], ['A1']]);
});

test('unterminated quote is an error', () => {
  assert.throws(() => parseCsv('a\n"oops\n'), CsvError);
});
