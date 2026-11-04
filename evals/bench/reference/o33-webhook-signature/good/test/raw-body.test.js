import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWebhook } from '../src/payments/webhooks.js';
import { signPayload } from '../src/payments/signature.js';

test('the signature is checked over the bytes Paylane sent, not re-serialized JSON', () => {
  const raw = JSON.stringify({ id: 'evt_x', amount: 12.5 }, null, 2);
  const out = handleWebhook({ headers: { 'paylane-signature': signPayload(raw, 'plk_test', 100) }, body: JSON.parse(raw), rawBody: raw }, { secret: 'plk_test', onEvent: () => {}, nowSec: 100 });
  assert.equal(out.status, 200);
});
