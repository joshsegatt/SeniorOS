import test from 'node:test';
import assert from 'node:assert/strict';
import { createBillingWorker, JobStore, OrderRepo, createFakeClock } from '../src/index.js';

function fakeGateway() {
  const charges = [];
  return {
    charges,
    async charge({ customerId, amountCents, idempotencyKey }) {
      assert.ok(idempotencyKey, 'idempotency key is required');
      const charge = { id: `ch_${charges.length + 1}`, customerId, amountCents };
      charges.push(charge);
      return charge;
    },
  };
}

test('charges an order, marks it paid and sends the receipt', async () => {
  const clock = createFakeClock();
  const orders = new OrderRepo();
  orders.add({ id: 'o1', customerId: 'cus_1', totalCents: 4200, currency: 'EUR', email: 'a@example.com' });
  const gateway = fakeGateway();
  const receipts = [];
  const worker = createBillingWorker({
    store: new JobStore(),
    orders,
    gateway,
    mailer: { sendReceipt: async (r) => receipts.push(r) },
    clock,
  });
  worker.chargeOrder('o1');
  worker.queue.start();
  await clock.advance(0);

  assert.equal(gateway.charges.length, 1);
  assert.equal(gateway.charges[0].amountCents, 4200);
  assert.deepEqual(orders.get('o1'), {
    id: 'o1',
    customerId: 'cus_1',
    totalCents: 4200,
    currency: 'EUR',
    email: 'a@example.com',
    status: 'paid',
    chargeId: 'ch_1',
  });
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].chargeId, 'ch_1');
});

test('a missing order fails the job without charging', async () => {
  const clock = createFakeClock();
  const store = new JobStore();
  const gateway = fakeGateway();
  const worker = createBillingWorker({
    store,
    orders: new OrderRepo(),
    gateway,
    mailer: { sendReceipt: async () => {} },
    clock,
    maxAttempts: 2,
    backoff: { baseMs: 10 },
  });
  const id = worker.chargeOrder('nope');
  worker.queue.start();
  await clock.advance(1000);
  assert.equal(store.get(id).status, 'failed');
  assert.equal(gateway.charges.length, 0);
});
