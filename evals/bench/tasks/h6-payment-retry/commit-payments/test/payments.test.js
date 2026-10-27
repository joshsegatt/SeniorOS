import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeOrder } from '../src/payments.js';

const order = { id: 'o-1001', lines: [{ sku: 'tea', priceCents: 10000, qty: 1 }], region: 'DE', cardToken: 'card_visa' };

test('charges the order total and returns the charge id', async () => {
  const requests = [];
  const gateway = {
    async charge(request) {
      requests.push(request);
      return { id: 'ch_1', amountCents: request.amountCents, currency: request.currency };
    },
  };
  assert.equal(await chargeOrder(order, gateway), 'ch_1');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].amountCents, 11900);
  assert.equal(requests[0].card, 'card_visa');
});
