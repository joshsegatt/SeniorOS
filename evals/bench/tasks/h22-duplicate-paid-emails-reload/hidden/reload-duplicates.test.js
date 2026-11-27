import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../src/app.js';
import { replay } from '../../src/replay.js';

const JOURNAL = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../data/ops-2026-11-24.json', import.meta.url)), 'utf8'),
);

const CONFIG = Object.freeze({
  version: 'h-1',
  shopName: 'Velo Werk',
  mail: { from: 'shop@velowerk.example', replyTo: 'hello@velowerk.example' },
  smtp: { host: 'smtp.test', user: 'velowerk' },
  loyalty: { pointsPerChf: 1 },
  webhooks: { urls: ['https://erp.test/hooks'] },
});

const order = (id, extra = {}) => ({ id, customer: 'c-1', email: 'lena@example.ch', totalCents: 12990, ...extra });

/** What a correct system does with the journal: config in force at each op. */
function expectations(journal) {
  let cfg = journal.config;
  const orders = new Map();
  const paid = [];
  const refunded = [];
  const replyTo = new Map();
  const points = new Map(); // customer -> balance
  const credited = new Map(); // orderId -> points
  for (const step of journal.ops) {
    if (step.op === 'config.change') cfg = step.config;
    if (step.op === 'order.create') orders.set(step.order.id, step.order);
    if (step.op === 'order.pay') {
      const o = orders.get(step.id);
      paid.push(o.id);
      replyTo.set(`Payment received - order ${o.id}`, cfg.mail.replyTo);
      const p = Math.floor(o.totalCents / 100) * cfg.loyalty.pointsPerChf;
      credited.set(o.id, p);
      points.set(o.customer, (points.get(o.customer) ?? 0) + p);
    }
    if (step.op === 'order.refund') {
      const o = orders.get(step.id);
      refunded.push(o.id);
      replyTo.set(`Refund issued - order ${o.id}`, cfg.mail.replyTo);
      points.set(o.customer, points.get(o.customer) - credited.get(o.id));
    }
  }
  return { paid, refunded, replyTo, points };
}

function countBy(items, key) {
  const m = new Map();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}

test('reported: replaying 24 Nov sends exactly one "Payment received" email per paid order', async () => {
  const app = await replay(JOURNAL);
  const exp = expectations(JOURNAL);
  const mails = app.transport.delivered();
  const bySubject = countBy(mails, (m) => m.subject);
  for (const id of exp.paid) assert.equal(bySubject.get(`Payment received - order ${id}`), 1, `order ${id}`);
  for (const id of exp.refunded) assert.equal(bySubject.get(`Refund issued - order ${id}`), 1, `refund ${id}`);
  assert.equal(mails.length, exp.paid.length + exp.refunded.length);
  assert.ok(app.logs.some((l) => /retrying send/.test(l)), 'the flaky SMTP window is part of the replay');
});

test('emails use the config that was live when the order was paid', async () => {
  const app = await replay(JOURNAL);
  const exp = expectations(JOURNAL);
  for (const m of app.transport.delivered()) {
    assert.equal(m.replyTo, exp.replyTo.get(m.subject), m.subject);
  }
});

test('same cause: loyalty points are credited once, at the rate live at payment', async () => {
  const app = await replay(JOURNAL);
  const exp = expectations(JOURNAL);
  for (const [customer, balance] of exp.points) {
    assert.equal(app.loyalty.balance(customer), balance, customer);
  }
});

test('same cause: ERP webhooks fire once per event; audit trail records each event once', async () => {
  const app = await replay(JOURNAL);
  const exp = expectations(JOURNAL);
  const posts = app.http.requests();
  assert.equal(posts.length, exp.paid.length + exp.refunded.length);
  const keys = posts.map((r) => `${r.body.event}:${r.body.orderId}`);
  assert.equal(new Set(keys).size, keys.length, 'duplicate webhook');
  const audit = app.audit.entries();
  assert.equal(audit.length, exp.paid.length + exp.refunded.length);
  assert.deepEqual(
    audit.filter((e) => e.event === 'order.paid').map((e) => e.orderId),
    exp.paid,
  );
});

test('same cause: after a webhook URL change only the new endpoint is called, once', async () => {
  const app = createApp(CONFIG);
  app.orders.create(order('A1'));
  await app.orders.pay('A1');
  app.reloadConfig({ ...CONFIG, version: 'h-2', webhooks: { urls: ['https://erp-new.test/hooks'] } });
  app.orders.create(order('A2'));
  await app.orders.pay('A2');
  const urls = app.http.requests().map((r) => `${r.url} ${r.body.orderId}`);
  assert.deepEqual(urls, ['https://erp.test/hooks A1', 'https://erp-new.test/hooks A2']);
});

test('editor double-save (same config pushed twice) changes nothing', async () => {
  const app = createApp(CONFIG);
  const watcher = new EventEmitter();
  app.watchConfig(watcher);
  const next = { ...CONFIG, version: 'h-2', loyalty: { pointsPerChf: 2 }, smtp: { host: 'smtp.test', user: 'rotated' } };
  watcher.emit('change', next);
  watcher.emit('change', next);
  app.orders.create(order('A1'));
  await app.orders.pay('A1');
  const mails = app.transport.delivered();
  assert.equal(mails.length, 1);
  assert.equal(mails[0].smtpUser, 'rotated', 'mail goes through the reloaded SMTP settings');
  assert.equal(app.loyalty.balance('c-1'), 258);
  assert.equal(app.http.requests().length, 1);
  assert.equal(app.audit.entries().length, 1);
  await app.orders.refund('A1');
  assert.equal(app.loyalty.balance('c-1'), 0);
  assert.equal(app.transport.delivered().length, 2);
  assert.equal(app.audit.entries().length, 2);
});

test('guard: a rejected reload keeps the running reactions intact', async () => {
  const app = createApp(CONFIG);
  const watcher = new EventEmitter();
  app.watchConfig(watcher);
  watcher.emit('change', { ...CONFIG, version: 'broken', mail: { from: 'not-an-address' } });
  app.orders.create(order('A1'));
  await app.orders.pay('A1');
  assert.equal(app.config.version, 'h-1');
  assert.equal(app.transport.delivered().length, 1);
  assert.equal(app.loyalty.balance('c-1'), 129);
  assert.equal(app.http.requests().length, 1);
  assert.equal(app.audit.entries().length, 1);
});

test('guard: distinct orders still get distinct emails; retries still deliver once', async () => {
  const app = createApp(CONFIG);
  app.reloadConfig({ ...CONFIG, version: 'h-2' });
  app.orders.create(order('A1'));
  app.orders.create(order('A2'));
  app.transport.failNext(2, 'ECONNRESET');
  await app.orders.pay('A1');
  await app.orders.pay('A2');
  const subjects = app.transport.delivered().map((m) => `${m.to} ${m.subject}`);
  assert.deepEqual(subjects, ['lena@example.ch Payment received - order A1', 'lena@example.ch Payment received - order A2']);
  assert.equal(app.logs.filter((l) => /retrying send/.test(l)).length, 2);
  assert.equal(app.bus.errors.length, 0);
});
