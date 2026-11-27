import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/api.js';
import { createCatalog } from '../../src/catalog.js';
import { createStock } from '../../src/stock.js';

// Gateway with the contract of docs/payment-gateway.md; `captures` are real captures.
function gatewayStub({ timeoutAfterFirstCapture = false } = {}) {
  const captures = [];
  const byKey = new Map();
  let timedOut = false;
  return {
    captures,
    async charge({ amountCents, currency, customerId, idempotencyKey }) {
      if (idempotencyKey && byKey.has(idempotencyKey)) return { chargeId: byKey.get(idempotencyKey) };
      const chargeId = `ch_${captures.length + 1}`;
      captures.push({ chargeId, amountCents, currency, customerId, idempotencyKey });
      if (idempotencyKey) byKey.set(idempotencyKey, chargeId);
      if (timeoutAfterFirstCapture && !timedOut) {
        timedOut = true;
        throw Object.assign(new Error('gateway timeout'), { code: 'GATEWAY_TIMEOUT' });
      }
      return { chargeId };
    },
  };
}

function setup(gatewayOptions) {
  const gateway = gatewayStub(gatewayOptions);
  const app = createApp({ catalog: createCatalog(), stock: createStock({ 'BOOK-1': 20, 'LAMP-2': 20 }), gateway });
  const checkout = (body) => app.handle({ method: 'POST', path: '/checkout', body });
  return { app, gateway, checkout };
}

test('a cart with a book and a gift card succeeds with exactly one capture', async () => {
  const { app, gateway, checkout } = setup();
  const res = await checkout({ customerId: 'cu_8812', items: [{ sku: 'BOOK-1', qty: 1 }, { sku: 'GIFT-50', qty: 1 }] });
  assert.equal(res.status, 201);
  assert.equal(gateway.captures.length, 1);
  assert.equal(gateway.captures[0].amountCents, 2900 + 5000 + 700);
  const order = app.orders.get(res.body.orderId);
  assert.equal(order.status, 'paid');
  const parcelSkus = (order.parcels ?? []).flatMap((parcel) => parcel.skus);
  assert.ok(!parcelSkus.includes('GIFT-50'), 'gift cards are never put into a parcel');
});

test('an all-digital cart succeeds, ships nothing and is charged once', async () => {
  const { gateway, checkout } = setup();
  const res = await checkout({ customerId: 'cu_5120', items: [{ sku: 'GIFT-50', qty: 2 }, { sku: 'EBOOK-7', qty: 1 }] });
  assert.equal(res.status, 201);
  assert.equal(res.body.totalCents, 11500);
  assert.equal(gateway.captures.length, 1);
  assert.equal(gateway.captures[0].amountCents, 11500);
});

test('physical carts still work', async () => {
  const { gateway, checkout } = setup();
  const res = await checkout({ customerId: 'cu_3307', items: [{ sku: 'LAMP-2', qty: 1 }] });
  assert.equal(res.status, 201);
  assert.equal(gateway.captures.length, 1);
  assert.equal(gateway.captures[0].amountCents, 10100);
});

test('a gateway timeout after capture never leads to a second capture', async () => {
  const { gateway, checkout } = setup({ timeoutAfterFirstCapture: true });
  await checkout({ customerId: 'cu_0091', items: [{ sku: 'BOOK-1', qty: 2 }] });
  assert.equal(gateway.captures.length, 1);
});

test('an out-of-stock cart charges nobody', async () => {
  const { gateway, checkout } = setup();
  const res = await checkout({ customerId: 'cu_1', items: [{ sku: 'LAMP-2', qty: 21 }] });
  assert.equal(res.status, 409);
  assert.equal(gateway.captures.length, 0);
});
