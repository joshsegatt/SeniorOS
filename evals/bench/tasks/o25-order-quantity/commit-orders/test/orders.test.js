import test from 'node:test';
import assert from 'node:assert/strict';
import { createShop } from '../src/orders/shop.js';
import { OutOfStock } from '../src/orders/inventory.js';
import { OrderLocked } from '../src/orders/orders.js';

const products = {
  MUG: { title: 'Mug', priceCents: 1200 },
  TEE: { title: 'T-shirt', priceCents: 2500 },
  CAP: { title: 'Cap', priceCents: 1800 },
};
const shop = () => createShop({ products, stock: { MUG: 10, TEE: 4, CAP: 0 }, now: () => new Date('2026-11-02T10:00:00Z') });

test('checkout prices the order and holds the stock', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'MUG', qty: 2 }, { sku: 'TEE', qty: 1 }]);
  assert.equal(order.status, 'pending');
  assert.equal(order.subtotalCents, 4900);
  assert.equal(order.shippingCents, 490);
  assert.equal(order.vatCents, 1078);
  assert.equal(order.totalCents, 6468);
  assert.equal(s.available('MUG'), 8);
  assert.equal(s.available('TEE'), 3);
});

test('free shipping from 50 euros', () => {
  const order = shop().checkout('c1', [{ sku: 'TEE', qty: 2 }]);
  assert.equal(order.shippingCents, 0);
  assert.equal(order.totalCents, 6000);
});

test('an item out of stock fails the whole checkout', () => {
  const s = shop();
  assert.throws(() => s.checkout('c1', [{ sku: 'MUG', qty: 1 }, { sku: 'CAP', qty: 1 }]), OutOfStock);
  assert.equal(s.available('MUG'), 10);
});

test('cancelling gives the stock back', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'TEE', qty: 3 }]);
  s.cancel(order.id);
  assert.equal(s.getOrder(order.id).status, 'cancelled');
  assert.equal(s.available('TEE'), 4);
});

test('shipping takes the units out of the warehouse', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'MUG', qty: 3 }]);
  s.ship(order.id);
  assert.equal(s.available('MUG'), 7);
  assert.throws(() => s.cancel(order.id), OrderLocked);
});

test('the address can change until the order ships', () => {
  const s = shop();
  const order = s.checkout('c1', [{ sku: 'MUG', qty: 1 }]);
  assert.equal(s.changeAddress(order.id, { city: 'Lyon' }).address.city, 'Lyon');
  s.ship(order.id);
  assert.throws(() => s.changeAddress(order.id, { city: 'Nice' }), OrderLocked);
});
