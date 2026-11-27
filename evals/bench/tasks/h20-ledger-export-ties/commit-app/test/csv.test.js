import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toCsv } from '../src/export/csv.js';

test('plain fields are not quoted', () => {
  assert.equal(toCsv(['a', 'b'], [['1', 'x']]), 'a,b\r\n1,x\r\n');
});

test('commas, quotes and newlines are quoted per RFC 4180', () => {
  const csv = toCsv(['memo'], [['Office supplies, Migros'], ['Lunch, team "offsite"'], ['two\nlines']]);
  assert.equal(csv, 'memo\r\n"Office supplies, Migros"\r\n"Lunch, team ""offsite"""\r\n"two\nlines"\r\n');
});

test('null and undefined become empty fields', () => {
  assert.equal(toCsv(['a', 'b', 'c'], [[null, undefined, 0]]), 'a,b,c\r\n,,0\r\n');
});
