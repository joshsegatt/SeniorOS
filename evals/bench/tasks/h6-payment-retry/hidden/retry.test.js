import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeOrder } from '../../src/payments.js';
import { CardDeclinedError, GatewayTimeoutError, GatewayUnavailableError } from '../../vendor/payco.js';

const order = { id: 'o-1001', lines: [{ sku: 'tea', priceCents: 10000, qty: 1 }], region: 'DE', cardToken: 'card_visa' };
const other = { id: 'o-1002', lines: [{ sku: 'cake', priceCents: 5000, qty: 1 }], region: 'DE', cardToken: 'card_amex' };

/**
 * A fake PayCo that behaves like the documented one: same idempotencyKey => processed at most once.
 * `script[i]` decides what the i-th call does: 'ok', 'timeout' (charged, but the answer is lost),
 * 'lost' (timed out before PayCo processed it), 'unavailable' (not processed) or 'declined'.
 */
function fakePayCo(script = []) {
  const calls = [];
  const charges = [];
  const processed = new Map();
  return {
    calls,
    charges,
    async charge(request) {
      calls.push({ ...request });
      if (request.idempotencyKey && processed.has(request.idempotencyKey)) return processed.get(request.idempotencyKey);
      const step = script[calls.length - 1] ?? 'ok';
      if (step === 'lost') throw new GatewayTimeoutError();
      if (step === 'unavailable') throw new GatewayUnavailableError();
      if (step === 'declined') throw new CardDeclinedError();
      charges.push({ ...request });
      const result = { id: `ch_${charges.length}`, amountCents: request.amountCents, currency: request.currency };
      if (request.idempotencyKey) processed.set(request.idempotencyKey, result);
      if (step === 'timeout') throw new GatewayTimeoutError();
      return result;
    },
  };
}

// The prompt asks to retry timeouts; retrying a 503 as well is optional (PayCo did not process it).
test('a 503 never charges the customer twice', async () => {
  const payco = fakePayCo(['unavailable']);
  const outcome = await chargeOrder(order, payco).then((id) => id, () => 'rejected');
  assert.ok(payco.calls.length <= 3);
  if (outcome === 'rejected') assert.equal(payco.charges.length, 0);
  else {
    assert.equal(outcome, 'ch_1');
    assert.equal(payco.charges.length, 1);
    assert.equal(payco.charges[0].amountCents, 11900);
  }
});

test('retries a timeout that never reached PayCo and charges once', async () => {
  const payco = fakePayCo(['lost']);
  assert.equal(await chargeOrder(order, payco), 'ch_1');
  assert.equal(payco.calls.length, 2);
  assert.equal(payco.charges.length, 1);
});

test('a timeout that already charged the card does not charge the customer twice', async () => {
  const payco = fakePayCo(['timeout']);
  const id = await chargeOrder(order, payco);
  assert.equal(payco.charges.length, 1, 'the customer was charged more than once');
  assert.equal(id, 'ch_1');
});

test('a declined card is not retried', async () => {
  const payco = fakePayCo(['declined', 'declined', 'declined']);
  await assert.rejects(chargeOrder(order, payco));
  assert.equal(payco.calls.length, 1);
  assert.equal(payco.charges.length, 0);
});

test('gives up after 3 attempts and reports the failure', async () => {
  const payco = fakePayCo(['lost', 'lost', 'lost', 'lost', 'lost']);
  await assert.rejects(chargeOrder(order, payco));
  assert.equal(payco.calls.length, 3);
  assert.equal(payco.charges.length, 0);
});

test('different orders are charged separately', async () => {
  const payco = fakePayCo();
  assert.equal(await chargeOrder(order, payco), 'ch_1');
  assert.equal(await chargeOrder(other, payco), 'ch_2');
  assert.equal(payco.charges.length, 2);
  assert.deepEqual(payco.charges.map((c) => c.amountCents), [11900, 5950]);
});
