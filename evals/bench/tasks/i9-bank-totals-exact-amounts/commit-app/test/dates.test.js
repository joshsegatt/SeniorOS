import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate } from '../src/dates.js';

test('parses each source date format', () => {
  assert.equal(parseDate('31.10.2026', 'DD.MM.YYYY'), '2026-10-31');
  assert.equal(parseDate('10/31/2026', 'MM/DD/YYYY'), '2026-10-31');
  assert.equal(parseDate(' 2026-10-31 ', 'YYYY-MM-DD'), '2026-10-31');
});

test('rejects impossible or mismatched dates', () => {
  assert.throws(() => parseDate('31.11.2026', 'DD.MM.YYYY'), /not a real day/);
  assert.throws(() => parseDate('2026-10-31', 'DD.MM.YYYY'), /does not match/);
});
