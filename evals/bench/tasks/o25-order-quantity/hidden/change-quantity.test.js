import test from 'node:test';
import assert from 'node:assert/strict';
import { createShop } from '../../src/orders/shop.js';
import { OrderLocked } from '../../src/orders/orders.js';

const products = {
  MUG: { title: 'Mug', priceCents: 1200 },
  TEE: { title: 'T-shirt', priceCents: 2500 },
};
const shop = () => createShop({ products, stock: { MUG: 10, TEE: 4 }, now: () => new Date('2026-11-02T10:00:00Z') });

test('the totals follow the new quantity', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'MUG', qty: 1 }, { sku: 'TEE', qty: 1 }]);
  const changed = s.changeQuantity(order.id, 'TEE', 2);
  assert.equal(changed.lines.find((l) => l.sku === 'TEE').qty, 2);
  assert.equal(changed.subtotalCents, 6200);
  assert.equal(changed.shippingCents, 0);
  assert.equal(changed.vatCents, 1240);
  assert.equal(changed.totalCents, 7440);
  assert.equal(s.getOrder(order.id).totalCents, 7440);
});

test('more units are held for the order when the quantity goes up', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'MUG', qty: 2 }]);
  s.changeQuantity(order.id, 'MUG', 5);
  assert.equal(s.available('MUG'), 5);
  const other = s.checkout('c2', [{ sku: 'MUG', qty: 5 }]);
  assert.equal(s.available('MUG'), 0);
  assert.throws(() => s.checkout('c3', [{ sku: 'MUG', qty: 1 }]));
  assert.ok(other.id);
});

test('a quantity the warehouse does not have is refused and nothing changes', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'TEE', qty: 1 }]);
  s.checkout('c2', [{ sku: 'TEE', qty: 2 }]);
  assert.throws(() => s.changeQuantity(order.id, 'TEE', 3));
  assert.equal(s.getOrder(order.id).lines[0].qty, 1);
  assert.equal(s.getOrder(order.id).totalCents, 3588);
  assert.equal(s.available('TEE'), 1);
});

test('fewer units free stock for other customers', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'TEE', qty: 4 }]);
  s.changeQuantity(order.id, 'TEE', 1);
  assert.equal(s.available('TEE'), 3);
  s.checkout('c2', [{ sku: 'TEE', qty: 3 }]);
  assert.equal(s.available('TEE'), 0);
});

test('cancelling after a change gives back exactly what the order held', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'MUG', qty: 2 }, { sku: 'TEE', qty: 3 }]);
  s.changeQuantity(order.id, 'MUG', 6);
  s.changeQuantity(order.id, 'TEE', 1);
  s.cancel(order.id);
  assert.equal(s.getOrder(order.id).status, 'cancelled');
  assert.equal(s.available('MUG'), 10);
  assert.equal(s.available('TEE'), 4);
});

test('shipping after a change takes out the new quantity', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'MUG', qty: 4 }]);
  s.changeQuantity(order.id, 'MUG', 1);
  s.ship(order.id);
  assert.equal(s.available('MUG'), 9);
  const up = s.checkout('c2', [{ sku: 'TEE', qty: 1 }]);
  s.changeQuantity(up.id, 'TEE', 3);
  s.ship(up.id);
  assert.equal(s.available('TEE'), 1);
});

test('a shipped order keeps its quantities', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'MUG', qty: 1 }]);
  s.ship(order.id);
  assert.throws(() => s.changeQuantity(order.id, 'MUG', 2), OrderLocked);
  assert.equal(s.available('MUG'), 9);
});
