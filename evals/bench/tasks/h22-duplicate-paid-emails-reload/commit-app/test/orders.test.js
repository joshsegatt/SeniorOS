import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { CONFIG, order } from './helpers.js';

test('a paid order sends one email, credits points, posts the webhook and is audited', async () => {
  const app = createApp(CONFIG);
  app.orders.create(order('A1'));
  await app.orders.pay('A1');

  const mails = app.transport.delivered();
  assert.equal(mails.length, 1);
  assert.equal(mails[0].subject, 'Payment received - order A1');
  assert.equal(mails[0].replyTo, 'hello@velowerk.example');
  assert.match(mails[0].text, /CHF 129\.90/);
  assert.equal(app.loyalty.balance('c-1'), 129);
  assert.deepEqual(app.http.requests().map((r) => r.url), ['https://erp.test/hooks']);
  assert.deepEqual(app.audit.entries(), [{ event: 'order.paid', orderId: 'A1', totalCents: 12990 }]);
});

test('refund sends one email and reverses the points', async () => {
  const app = createApp(CONFIG);
  app.orders.create(order('A1'));
  await app.orders.pay('A1');
  await app.orders.refund('A1');
  assert.deepEqual(app.transport.delivered().map((m) => m.subject), ['Payment received - order A1', 'Refund issued - order A1']);
  assert.equal(app.loyalty.balance('c-1'), 0);
  assert.equal(app.audit.entries().length, 2);
});

test('an order cannot be paid twice', async () => {
  const app = createApp(CONFIG);
  app.orders.create(order('A1'));
  await app.orders.pay('A1');
  await assert.rejects(app.orders.pay('A1'), /is paid/);
});
