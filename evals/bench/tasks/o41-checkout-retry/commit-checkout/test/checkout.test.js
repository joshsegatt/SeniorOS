import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';
import { defaultCatalog, priceItems } from '../src/catalog.js';
import { formatEuros } from '../src/notifications/outbox.js';

const basket = { customerId: 'c-2207', items: [{ sku: 'TEA-SENCHA-100', qty: 2 }, { sku: 'KETTLE-GOOSE', qty: 1 }, { sku: 'MUG-STONE', qty: 1 }], paymentMethod: 'pm_visa_4242' };
const checkout = (key, body = basket) => ({ method: 'POST', path: '/checkout', headers: key ? { 'idempotency-key': key } : {}, body });
const refund = (orderId, key, amountCents) => ({ method: 'POST', path: `/orders/${orderId}/refunds`, headers: key ? { 'idempotency-key': key } : {}, body: { amountCents } });

test('pricing a basket', () => {
  const priced = priceItems(defaultCatalog(), basket.items);
  assert.equal(priced.totalCents, 8640);
  assert.equal(formatEuros(priced.totalCents), '€86.40');
  assert.throws(() => priceItems(defaultCatalog(), [{ sku: 'TEA-EARLGREY-100', qty: 1 }]), /unknown product/);
  assert.throws(() => priceItems(defaultCatalog(), []), /empty/);
});

test('checkout charges the order and sends one confirmation', async () => {
  const app = createApp();
  const res = await app.handle(checkout('k-1'));
  assert.equal(res.status, 201);
  assert.equal(res.body.order.status, 'paid');
  assert.equal(res.body.order.totalCents, 8640);
  assert.equal(app.gateway.charges.length, 1);
  assert.equal(app.outbox.messages.length, 1);
  assert.equal((await app.handle({ method: 'GET', path: `/orders/${res.body.order.id}` })).body.order.chargeId, app.gateway.charges[0].id);
});

test('a retry with the same key returns the original order and charges nothing', async () => {
  const app = createApp();
  const first = await app.handle(checkout('k-retry'));
  const retry = await app.handle(checkout('k-retry'));
  assert.deepEqual(retry, first);
  assert.equal(app.gateway.charges.length, 1);
  assert.equal((await app.orders.all()).length, 1);
});

test('the same key with a different basket is refused', async () => {
  const app = createApp();
  await app.handle(checkout('k-2'));
  const other = await app.handle(checkout('k-2', { ...basket, items: [{ sku: 'MUG-STONE', qty: 1 }] }));
  assert.equal(other.status, 422);
  assert.equal(app.gateway.charges.length, 1);
});

test('two checkouts with their own keys are two orders', async () => {
  const app = createApp();
  assert.equal((await app.handle(checkout('k-a'))).status, 201);
  assert.equal((await app.handle(checkout('k-b'))).status, 201);
  assert.equal(app.gateway.charges.length, 2);
});

test('a declined card is kept as the answer for that key', async () => {
  const app = createApp();
  const declined = await app.handle(checkout('k-d', { ...basket, paymentMethod: 'pm_card_declined' }));
  assert.equal(declined.status, 402);
  assert.deepEqual(await app.handle(checkout('k-d', { ...basket, paymentMethod: 'pm_card_declined' })), declined);
});

test('a retry after the provider was down goes through', async () => {
  const app = createApp();
  app.gateway.failNext = true;
  assert.equal((await app.handle(checkout('k-down'))).status, 502);
  const retry = await app.handle(checkout('k-down'));
  assert.equal(retry.status, 201);
  assert.equal(app.gateway.charges.length, 1);
});

test('refunds: partial, retried, and never more than the charge', async () => {
  const app = createApp();
  const { order } = (await app.handle(checkout('k-r'))).body;
  const first = await app.handle(refund(order.id, 'r-1', 2000));
  assert.equal(first.status, 201);
  assert.deepEqual(await app.handle(refund(order.id, 'r-1', 2000)), first);
  assert.equal(app.gateway.refunds.length, 1);
  assert.equal((await app.handle(refund(order.id, 'r-2', 7000))).status, 422);
  assert.equal((await app.handle(refund(order.id, 'r-3', 6640))).body.order.refundedCents, 8640);
  assert.equal((await app.handle(refund('o-1', 'r-4', 100))).status, 404);
});

test('refunds sent at the same moment with their own keys stay within the charge', async () => {
  const app = createApp();
  const { order } = (await app.handle(checkout('k-r2'))).body;
  const results = await Promise.all([app.handle(refund(order.id, 'r-a', 5000)), app.handle(refund(order.id, 'r-b', 5000))]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 422]);
  assert.equal(app.gateway.refunds.length, 1);
});
