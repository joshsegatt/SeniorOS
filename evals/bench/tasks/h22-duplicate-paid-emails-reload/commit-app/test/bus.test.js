import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBus } from '../src/bus/eventBus.js';

test('handlers run in order and can be removed', async () => {
  const bus = createBus();
  const seen = [];
  const offA = bus.on('e', (p) => seen.push(`a${p}`));
  bus.on('e', (p) => seen.push(`b${p}`));
  await bus.emit('e', 1);
  offA();
  await bus.emit('e', 2);
  assert.deepEqual(seen, ['a1', 'b1', 'b2']);
  assert.equal(bus.listenerCount('e'), 1);
});

test('registering the same function twice is a no-op', async () => {
  const bus = createBus();
  let n = 0;
  const fn = () => n++;
  bus.on('e', fn);
  bus.on('e', fn);
  await bus.emit('e');
  assert.equal(n, 1);
});

test('a failing handler does not stop the others', async () => {
  const bus = createBus();
  let ran = false;
  bus.on('e', () => {
    throw new Error('boom');
  });
  bus.on('e', () => {
    ran = true;
  });
  await bus.emit('e');
  assert.equal(ran, true);
  assert.equal(bus.errors.length, 1);
});
