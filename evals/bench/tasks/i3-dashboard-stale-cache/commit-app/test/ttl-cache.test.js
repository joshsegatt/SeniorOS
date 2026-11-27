import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTtlCache } from '../src/ttl-cache.js';
import { fakeClock } from './helpers/fake-clock.js';

test('entries expire after the TTL', () => {
  const clock = fakeClock('2026-11-27T10:00:00Z');
  const cache = createTtlCache({ ttlMs: 1000, clock });
  cache.set('a', 1);
  clock.advance(999);
  assert.equal(cache.get('a'), 1);
  clock.advance(1);
  assert.equal(cache.get('a'), undefined);
});

test('delete removes an entry', () => {
  const cache = createTtlCache({ ttlMs: 1000, clock: fakeClock('2026-11-27T10:00:00Z') });
  cache.set('a', 1);
  cache.delete('a');
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.size, 0);
});

test('rejects a non-positive TTL', () => {
  assert.throws(() => createTtlCache({ ttlMs: 0, clock: fakeClock('2026-11-27T10:00:00Z') }), RangeError);
});
