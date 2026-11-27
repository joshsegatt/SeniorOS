import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/api.js';
import { createCatalog } from '../src/catalog.js';
import { createStock } from '../src/stock.js';
import { createGatewayStub } from './helpers/gateway-stub.js';

function setup(gatewayOptions) {
  const gateway = createGatewayStub(gatewayOptions);
  const stock = createStock({ 'BOOK-1': 5, 'LAMP-2': 1, 'BENCH-3': 3 });
  const app = createApp({ catalog: createCatalog(), stock, gateway });
  const checkout = (body) => app.handle({ method: 'POST', path: '/checkout', body });
  return { app, gateway, stock, checkout };
}

test('a physical cart becomes a paid order with one capture', async () => {
  const { app, gateway, checkout } = setup();
  const res = await checkout({ customerId: 'cu_1', items: [{ sku: 'BOOK-1', qty: 2 }] });
  assert.equal(res.status, 201);
  assert.equal(res.body.totalCents, 2 * 2900 + 700);
  assert.equal(gateway.captures.length, 1);
  assert.equal(gateway.captures[0].amountCents, 6500);
  assert.equal(app.orders.get(res.body.orderId).status, 'paid');
});

test('heavy orders are split into parcels of at most 30 kg', async () => {
  const { app, checkout } = setup();
  const res = await checkout({ customerId: 'cu_1', items: [{ sku: 'BENCH-3', qty: 2 }] });
  assert.equal(res.status, 201);
  assert.equal(app.orders.get(res.body.orderId).parcels.length, 2);
});

test('out of stock is a 409 and nobody is charged', async () => {
  const { gateway, checkout } = setup();
  const res = await checkout({ customerId: 'cu_1', items: [{ sku: 'LAMP-2', qty: 2 }] });
  assert.equal(res.status, 409);
  assert.equal(gateway.captures.length, 0);
});

test('an invalid cart is a 400', async () => {
  const { checkout } = setup();
  assert.equal((await checkout({ customerId: 'cu_1', items: [{ sku: 'BOOK-1', qty: 0 }] })).status, 400);
  assert.equal((await checkout({ customerId: 'cu_1', items: [{ sku: 'NOPE', qty: 1 }] })).status, 400);
  assert.equal((await checkout({ customerId: 'cu_1', items: [] })).status, 400);
});

test('a declined card is a 402 and the stock is released', async () => {
  const { stock, checkout } = setup({ declineAll: true });
  const res = await checkout({ customerId: 'cu_1', items: [{ sku: 'LAMP-2', qty: 1 }] });
  assert.equal(res.status, 402);
  assert.equal(stock.available('LAMP-2'), 1);
});

test('unknown routes are 404', async () => {
  const { app } = setup();
  assert.equal((await app.handle({ method: 'GET', path: '/nope' })).status, 404);
});
