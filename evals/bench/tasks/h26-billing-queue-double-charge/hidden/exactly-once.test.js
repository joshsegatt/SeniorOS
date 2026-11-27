import test from 'node:test';
import assert from 'node:assert/strict';
import { createBillingWorker, JobStore, OrderRepo, GatewayError } from '../../src/index.js';

// ---------------------------------------------------------------- harness

function fakeClock(start = 0) {
  let now = start;
  let nextId = 1;
  const timers = new Map();
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, id });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    async advance(ms) {
      const target = now + ms;
      await settle();
      for (;;) {
        let due = null;
        for (const t of timers.values()) {
          if (t.at <= target && (due === null || t.at < due.at || (t.at === due.at && t.id < due.id))) due = t;
        }
        if (due === null) break;
        timers.delete(due.id);
        now = due.at;
        due.fn();
        await settle();
      }
      now = target;
      await settle();
    },
  };
}

const never = () => new Promise(() => {});
const sleep = (clock, ms) => new Promise((resolve) => clock.setTimeout(resolve, ms));

// Gateway that honours the documented idempotency contract. Behaviour of the
// n-th request for a customer can be scripted.
function fakeGateway(clock) {
  const byKey = new Map();
  const charges = [];
  const scripts = new Map();
  const requests = new Map();
  return {
    charges,
    script(customerId, steps) {
      scripts.set(customerId, steps);
    },
    requestsFor: (customerId) => requests.get(customerId) ?? 0,
    chargesFor: (customerId) => charges.filter((c) => c.customerId === customerId),
    async charge({ customerId, amountCents, currency, idempotencyKey }) {
      const n = requests.get(customerId) ?? 0;
      requests.set(customerId, n + 1);
      const step = (scripts.get(customerId) ?? [])[n] ?? {};
      if (typeof idempotencyKey !== 'string' || idempotencyKey === '') {
        throw new GatewayError('idempotency key required', { code: 'bad_request', retryable: false });
      }
      if (step.hangBeforeRequest) return never();
      if (step.reject) {
        await sleep(clock, 5);
        throw new GatewayError('HTTP 503', { code: 'gateway_error', retryable: true });
      }
      const existing = byKey.get(idempotencyKey);
      if (existing) {
        await sleep(clock, 5);
        if (existing.state === 'in_flight') {
          throw new GatewayError('a request with this idempotency key is in progress', {
            code: 'idempotency_in_progress',
            retryable: true,
          });
        }
        return { ...existing.result };
      }
      const entry = { state: 'in_flight', result: null };
      byKey.set(idempotencyKey, entry);
      await sleep(clock, step.latencyMs ?? 10);
      const result = { id: `ch_${charges.length + 1}`, customerId, amountCents, currency };
      charges.push(result);
      entry.state = 'done';
      entry.result = result;
      if (step.loseResponse) throw new GatewayError('network error: socket hang up', { code: 'network', retryable: true });
      if (step.hangAfterCharge) return never();
      return { ...result };
    },
  };
}

function fakeMailer(clock) {
  const delivered = [];
  const failuresLeft = new Map();
  return {
    delivered,
    failFirst(orderId, times) {
      failuresLeft.set(orderId, times);
    },
    async sendReceipt(receipt) {
      await sleep(clock, 5);
      const left = failuresLeft.get(receipt.orderId) ?? 0;
      if (left > 0) {
        failuresLeft.set(receipt.orderId, left - 1);
        throw new Error('SMTP 421 try again later');
      }
      delivered.push(receipt);
    },
    deliveredFor: (orderId) => delivered.filter((r) => r.orderId === orderId),
  };
}

function addOrder(orders, n) {
  const id = `o${n}`;
  orders.add({ id, customerId: `cus_${n}`, totalCents: 1000 + n, currency: 'EUR', email: `c${n}@example.com` });
  return id;
}

// A worker "process" that can be SIGKILLed: after kill() its timers never fire
// and anything it is awaiting never resumes, but work already sent to the
// gateway still happens on the gateway side.
function processFor({ clock, gateway, mailer }) {
  let dead = false;
  const freeze = async (p) => {
    const value = await p;
    if (dead) return never();
    return value;
  };
  return {
    kill() {
      dead = true;
    },
    clock: {
      now: () => clock.now(),
      setTimeout: (fn, ms) => clock.setTimeout(() => { if (!dead) fn(); }, ms),
      clearTimeout: (h) => clock.clearTimeout(h),
    },
    gateway: {
      charge: (args) =>
        freeze(
          gateway.charge(args).catch((err) => {
            if (dead) return never();
            throw err;
          }),
        ),
    },
    mailer: {
      sendReceipt: (r) =>
        freeze(
          mailer.sendReceipt(r).catch((err) => {
            if (dead) return never();
            throw err;
          }),
        ),
    },
  };
}

function world() {
  const clock = fakeClock();
  return { clock, store: new JobStore(), orders: new OrderRepo(), gateway: fakeGateway(clock), mailer: fakeMailer(clock) };
}

function worker(w, options = {}) {
  return createBillingWorker({
    store: w.store,
    orders: w.orders,
    gateway: w.gateway,
    mailer: w.mailer,
    clock: w.clock,
    backoff: { baseMs: 1000 },
    ...options,
  });
}

function assertChargedOnce(w, n) {
  const orderId = `o${n}`;
  const charges = w.gateway.chargesFor(`cus_${n}`);
  assert.equal(charges.length, 1, `${orderId} must be charged exactly once, got ${charges.length}`);
  assert.equal(charges[0].amountCents, 1000 + n);
  const order = w.orders.get(orderId);
  assert.equal(order.status, 'paid', `${orderId} must be paid`);
  assert.equal(order.chargeId, charges[0].id, `${orderId} must point at its only charge`);
}

// ---------------------------------------------------------------- double charges

test('receipt email failure: retry does not charge again', async () => {
  const w = world();
  addOrder(w.orders, 1);
  w.mailer.failFirst('o1', 1);
  const wk = worker(w);
  const id = wk.chargeOrder('o1');
  wk.queue.start();
  await w.clock.advance(10_000);
  assert.equal(w.store.get(id).status, 'done');
  assertChargedOnce(w, 1);
  assert.equal(w.mailer.deliveredFor('o1').length, 1);
});

test('charge succeeded but the response was lost: retry does not charge again', async () => {
  const w = world();
  addOrder(w.orders, 2);
  w.gateway.script('cus_2', [{ loseResponse: true }]);
  const wk = worker(w);
  const id = wk.chargeOrder('o2');
  wk.queue.start();
  await w.clock.advance(10_000);
  assert.equal(w.store.get(id).status, 'done');
  assertChargedOnce(w, 2);
  assert.ok(w.mailer.deliveredFor('o2').length >= 1);
});

test('attempt timed out while the gateway was still charging: no second charge', async () => {
  const w = world();
  addOrder(w.orders, 3);
  w.gateway.script('cus_3', [{ latencyMs: 35_000 }]);
  const wk = worker(w, { attemptTimeoutMs: 30_000, maxAttempts: 6 });
  const id = wk.chargeOrder('o3');
  wk.queue.start();
  await w.clock.advance(120_000);
  assert.equal(w.store.get(id).status, 'done');
  assertChargedOnce(w, 3);
  assert.ok(w.mailer.deliveredFor('o3').length >= 1);
});

test('a request that never reached the gateway is still retried after the timeout', async () => {
  const w = world();
  addOrder(w.orders, 4);
  w.gateway.script('cus_4', [{ hangBeforeRequest: true }]);
  const wk = worker(w, { attemptTimeoutMs: 5000 });
  const id = wk.chargeOrder('o4');
  wk.queue.start();
  await w.clock.advance(20_000);
  assert.equal(w.store.get(id).status, 'done');
  assertChargedOnce(w, 4);
});

test('gateway 503 before charging is retried and charged once', async () => {
  const w = world();
  addOrder(w.orders, 5);
  w.gateway.script('cus_5', [{ reject: true }, { reject: true }]);
  const wk = worker(w);
  const id = wk.chargeOrder('o5');
  wk.queue.start();
  await w.clock.advance(20_000);
  assert.equal(w.store.get(id).status, 'done');
  assertChargedOnce(w, 5);
});

// ---------------------------------------------------------------- shutdown / restart

test('stop() waits for in-flight attempts, records them, and starts nothing new', async () => {
  const w = world();
  addOrder(w.orders, 6);
  addOrder(w.orders, 7);
  w.gateway.script('cus_6', [{ latencyMs: 5000 }]);
  w.gateway.script('cus_7', [{ latencyMs: 5000 }]);
  const wk = worker(w, { concurrency: 1 });
  const id6 = wk.chargeOrder('o6');
  const id7 = wk.chargeOrder('o7');
  wk.queue.start();
  await w.clock.advance(1000);
  assert.equal(w.store.get(id6).status, 'running');

  let stopped = false;
  Promise.resolve(wk.queue.stop()).then(() => { stopped = true; });
  await w.clock.advance(1000);
  assert.equal(stopped, false, 'stop() must not resolve while an attempt is in flight');

  await w.clock.advance(5000);
  assert.equal(stopped, true, 'stop() must resolve once the in-flight attempt settled');
  assert.equal(w.store.get(id6).status, 'done');
  assertChargedOnce(w, 6);
  assert.equal(w.store.get(id7).status, 'queued');
  assert.equal(w.gateway.requestsFor('cus_7'), 0, 'no new job may start after stop()');

  const next = worker(w, { concurrency: 1 });
  next.queue.start();
  await w.clock.advance(10_000);
  assert.equal(w.store.get(id7).status, 'done');
  assertChargedOnce(w, 7);
  assertChargedOnce(w, 6);
});

test('a job waiting for its retry when the worker stops is retried by the next worker', async () => {
  const w = world();
  addOrder(w.orders, 8);
  w.mailer.failFirst('o8', 1);
  const wk = worker(w);
  const id = wk.chargeOrder('o8');
  wk.queue.start();
  await w.clock.advance(100);
  assert.equal(w.store.get(id).status, 'retrying');
  await Promise.resolve(wk.queue.stop());

  const next = worker(w);
  next.queue.start();
  await w.clock.advance(10_000);
  assert.equal(w.store.get(id).status, 'done');
  assertChargedOnce(w, 8);
  assert.equal(w.mailer.deliveredFor('o8').length, 1);
});

test('an attempt that fails during stop() is retried by the next worker', async () => {
  const w = world();
  addOrder(w.orders, 9);
  w.gateway.script('cus_9', [{ latencyMs: 2000, loseResponse: true }]);
  const wk = worker(w);
  const id = wk.chargeOrder('o9');
  wk.queue.start();
  await w.clock.advance(500);
  const stopping = Promise.resolve(wk.queue.stop());
  await w.clock.advance(3000);
  await stopping;
  assert.notEqual(w.store.get(id).status, 'running');

  const next = worker(w);
  next.queue.start();
  await w.clock.advance(10_000);
  assert.equal(w.store.get(id).status, 'done');
  assertChargedOnce(w, 9);
});

test('a job left running by a SIGKILLed worker is picked up and not charged twice', async () => {
  const w = world();
  addOrder(w.orders, 10);
  w.gateway.script('cus_10', [{ latencyMs: 50 }]);
  const p1 = processFor(w);
  const first = createBillingWorker({
    store: w.store, orders: w.orders, gateway: p1.gateway, mailer: p1.mailer, clock: p1.clock,
    attemptTimeoutMs: 600_000, backoff: { baseMs: 1000 },
  });
  const id = first.chargeOrder('o10');
  first.queue.start();
  await w.clock.advance(20);
  p1.kill(); // request is at the gateway; the pod dies before the response arrives
  await w.clock.advance(1000);
  assert.equal(w.gateway.chargesFor('cus_10').length, 1, 'the gateway did charge');
  assert.equal(w.store.get(id).status, 'running');

  const next = worker(w);
  next.queue.start();
  await w.clock.advance(10_000);
  assert.equal(w.store.get(id).status, 'done');
  assertChargedOnce(w, 10);
  assert.equal(w.mailer.deliveredFor('o10').length, 1);
});

// ---------------------------------------------------------------- soak

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('soak: flaky gateway and SMTP, a graceful stop and a SIGKILL — every order charged exactly once', async () => {
  const w = world();
  const random = rng(26);
  const N = 300;
  for (let n = 100; n < 100 + N; n++) {
    addOrder(w.orders, n);
    const r = random();
    const latency = 10 + Math.floor(random() * 300);
    if (r < 0.15) w.gateway.script(`cus_${n}`, [{ latencyMs: latency, loseResponse: true }]);
    else if (r < 0.3) w.gateway.script(`cus_${n}`, [{ latencyMs: 2500 }]);
    else if (r < 0.4) w.gateway.script(`cus_${n}`, [{ reject: true }, { latencyMs: latency }]);
    else w.gateway.script(`cus_${n}`, [{ latencyMs: latency }]);
    if (random() < 0.2) w.mailer.failFirst(`o${n}`, 1);
  }
  const options = { concurrency: 8, attemptTimeoutMs: 2000, maxAttempts: 12, backoff: { baseMs: 50, maxMs: 2000 } };

  const p1 = processFor(w);
  const w1 = createBillingWorker({ store: w.store, orders: w.orders, gateway: p1.gateway, mailer: p1.mailer, clock: p1.clock, ...options });
  for (let n = 100; n < 100 + N; n++) w1.chargeOrder(`o${n}`);
  w1.queue.start();
  await w.clock.advance(1500);
  const stopping = Promise.resolve(w1.queue.stop());
  await w.clock.advance(3000);
  await stopping;

  const p2 = processFor(w);
  const w2 = createBillingWorker({ store: w.store, orders: w.orders, gateway: p2.gateway, mailer: p2.mailer, clock: p2.clock, ...options });
  w2.queue.start();
  await w.clock.advance(2500);
  p2.kill();
  await w.clock.advance(100);

  const p3 = processFor(w);
  const w3 = createBillingWorker({ store: w.store, orders: w.orders, gateway: p3.gateway, mailer: p3.mailer, clock: p3.clock, ...options });
  w3.queue.start();
  await w.clock.advance(300_000);

  const notDone = w.store.list().filter((j) => j.status !== 'done').map((j) => `${j.id}:${j.status}`);
  assert.deepEqual(notDone, []);
  for (let n = 100; n < 100 + N; n++) {
    assertChargedOnce(w, n);
    assert.ok(w.mailer.deliveredFor(`o${n}`).length >= 1, `o${n} receipt`);
  }
  assert.equal(w.gateway.charges.length, N);
});
