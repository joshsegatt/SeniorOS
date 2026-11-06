import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/http/app.js';

const basket = { customerId: 'c-2207', items: [{ sku: 'TEA-SENCHA-100', qty: 2 }, { sku: 'KETTLE-GOOSE', qty: 1 }, { sku: 'MUG-STONE', qty: 1 }], paymentMethod: 'pm_visa_4242' };
const checkout = (key, body = basket) => ({ method: 'POST', path: '/checkout', headers: { 'idempotency-key': key }, body });
const refund = (orderId, key, amountCents) => ({ method: 'POST', path: `/orders/${orderId}/refunds`, headers: { 'idempotency-key': key }, body: { amountCents } });

/** One of the two answers is the original, the other is the same answer or a 409 "still in progress". */
function oneOriginal(responses, status) {
  const originals = responses.filter((r) => r.status === status);
  assert.ok(originals.length >= 1, `expected a ${status}, got ${responses.map((r) => r.status).join(', ')}`);
  for (const r of responses) if (r.status !== 409) assert.deepEqual(r, originals[0]);
  return originals[0];
}

test('the reported case: a retry that overlaps the first checkout charges once', async () => {
  const app = createApp();
  const responses = await Promise.all([app.handle(checkout('7d1c9e2a')), app.handle(checkout('7d1c9e2a'))]);
  oneOriginal(responses, 201);
  assert.equal(app.gateway.charges.length, 1, 'one charge');
  assert.equal((await app.orders.all()).length, 1, 'one order');
  assert.equal(app.outbox.messages.length, 1, 'one confirmation email');
});

test('three overlapping retries still make one order, and a later retry returns it', async () => {
  const app = createApp();
  const responses = await Promise.all([1, 2, 3].map(() => app.handle(checkout('k-3x'))));
  const original = oneOriginal(responses, 201);
  assert.equal(app.gateway.charges.length, 1);
  assert.deepEqual(await app.handle(checkout('k-3x')), original);
  assert.equal((await app.orders.all()).length, 1);
});

test('an overlapping retry of a refund refunds once', async () => {
  const app = createApp();
  const { order } = (await app.handle(checkout('k-pay'))).body;
  const responses = await Promise.all([app.handle(refund(order.id, 'r-1', 2000)), app.handle(refund(order.id, 'r-1', 2000))]);
  oneOriginal(responses, 201);
  assert.equal(app.gateway.refunds.length, 1, 'one refund at the provider');
  assert.equal((await app.orders.get(order.id)).refundedCents, 2000);
});

test('overlapping checkouts with their own keys are both made', async () => {
  const app = createApp();
  const responses = await Promise.all([app.handle(checkout('k-a')), app.handle(checkout('k-b'))]);
  assert.deepEqual(responses.map((r) => r.status), [201, 201]);
  assert.equal(app.gateway.charges.length, 2);
});

test('the same key reused for a different basket while the first runs is not charged', async () => {
  const app = createApp();
  const other = { ...basket, items: [{ sku: 'MUG-STONE', qty: 1 }] };
  const [, second] = await Promise.all([app.handle(checkout('k-x')), app.handle(checkout('k-x', other))]);
  assert.ok([409, 422].includes(second.status), `got ${second.status}`);
  assert.equal(app.gateway.charges.length, 1);
});

test('after an outage the retry still goes through', async () => {
  const app = createApp();
  app.gateway.failNext = true;
  assert.equal((await app.handle(checkout('k-down'))).status, 502);
  const retry = await app.handle(checkout('k-down'));
  assert.equal(retry.status, 201);
  assert.equal(app.gateway.charges.length, 1);
});

test('an outage during overlapping retries does not leave the key stuck', async () => {
  const app = createApp();
  app.gateway.failNext = true;
  const responses = await Promise.all([app.handle(checkout('k-flaky')), app.handle(checkout('k-flaky'))]);
  assert.ok(app.gateway.charges.length <= 1);
  if (responses.every((r) => r.status !== 201)) {
    const retry = await app.handle(checkout('k-flaky'));
    assert.equal(retry.status, 201);
  }
  assert.equal(app.gateway.charges.length, 1);
});
