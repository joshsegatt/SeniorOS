import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createShopApp } from '../../src/shop/app.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

function fakePayments() {
  const p = { charges: [], refunds: [] };
  p.charge = (customerId, cents) => (p.charges.push({ customerId, cents }), `pay_${p.charges.length}`);
  p.refund = (paymentId) => p.refunds.push(paymentId);
  return p;
}
const cart = (lines, customerId = 'c1') => ({ customerId, email: `${customerId}@example.com`, lines });

test('nothing uses the old bus any more', () => {
  for (const file of walk(join(root, 'src')).filter((f) => f.endsWith('.js') && !/[\\/]lib[\\/]bus\.js$/.test(f))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /lib\/bus\.js|createBus/, file);
  }
});

test('an order for stock we do not have is refused before the card is charged', async () => {
  const payments = fakePayments();
  const app = createShopApp({ stock: { MUG: 1, TEE: 5 }, payments });
  const res = await app.api.placeOrder(cart([{ sku: 'TEE', qty: 1, unitCents: 2000 }, { sku: 'MUG', qty: 2, unitCents: 1250 }]));
  assert.deepEqual(res, { status: 409, body: { error: 'out_of_stock', sku: 'MUG' } });
  assert.deepEqual(payments.charges, []);
  assert.equal(app.inventory.level('MUG'), 1);
  assert.equal(app.inventory.level('TEE'), 5);
  assert.equal(app.loyalty.points('c1'), 0);
  assert.deepEqual(app.outbox, []);
});

test('the last unit goes to one customer only', async () => {
  const payments = fakePayments();
  const app = createShopApp({ stock: { MUG: 1 }, payments });
  const first = await app.api.placeOrder(cart([{ sku: 'MUG', qty: 1, unitCents: 1250 }], 'ana'));
  const second = await app.api.placeOrder(cart([{ sku: 'MUG', qty: 1, unitCents: 1250 }], 'bo'));
  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
  assert.deepEqual(payments.charges, [{ customerId: 'ana', cents: 1250 }]);
  assert.equal(app.inventory.level('MUG'), 0);
});

test('orders still charge, reserve, award points and mail', async () => {
  const payments = fakePayments();
  const app = createShopApp({ stock: { MUG: 5 }, payments });
  const res = await app.api.placeOrder(cart([{ sku: 'MUG', qty: 2, unitCents: 1250 }]));
  assert.deepEqual(res, { status: 201, body: { id: 'o1', status: 'paid', totalCents: 2500 } });
  assert.equal(app.inventory.level('MUG'), 3);
  assert.equal(app.loyalty.points('c1'), 25);
  assert.deepEqual(app.outbox, [{ to: 'c1@example.com', template: 'order-confirmation', orderId: 'o1' }]);
  const order = await app.checkout.place(cart([{ sku: 'MUG', qty: 1, unitCents: 1250 }]));
  await app.checkout.cancel(order);
  assert.equal(app.inventory.level('MUG'), 3);
  assert.deepEqual(payments.refunds, ['pay_2']);
});
