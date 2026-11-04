import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWebhook } from '../src/payments/webhooks.js';
import { signPayload, verifySignature } from '../src/payments/signature.js';

const SECRET = 'whsec_test_local';
const NOW = 1_762_000_000;

test('a signed event is accepted and handed on', () => {
  const event = { id: 'evt_1', type: 'payment.succeeded', amount: 1200 };
  const seen = [];
  const out = handleWebhook({ headers: { 'paylane-signature': signPayload(JSON.stringify(event), SECRET, NOW) }, body: event, rawBody: JSON.stringify(event) }, { secret: SECRET, onEvent: (e) => seen.push(e), nowSec: NOW });
  assert.equal(out.status, 200);
  assert.deepEqual(seen, [event]);
});

test('a wrong signature is refused', () => {
  const event = { id: 'evt_2', type: 'payment.succeeded', amount: 1200 };
  const out = handleWebhook({ headers: { 'paylane-signature': signPayload(JSON.stringify(event), 'other', NOW) }, body: event, rawBody: JSON.stringify(event) }, { secret: SECRET, onEvent: () => {}, nowSec: NOW });
  assert.equal(out.status, 401);
});

test('an old delivery is refused as a replay', () => {
  assert.equal(verifySignature('{}', signPayload('{}', SECRET, NOW - 3600), SECRET, NOW), false);
});
