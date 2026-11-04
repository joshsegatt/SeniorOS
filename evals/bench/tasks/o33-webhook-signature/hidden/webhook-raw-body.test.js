import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from '../../src/payments/server.js';

const SECRET = 'whsec_test_hidden';
const NOW = 1_793_607_243;
const sign = (raw, t = NOW) => `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')}`;

async function post(raw, signature) {
  const seen = [];
  const server = createServer({ secret: SECRET, onEvent: (e) => seen.push(e), nowSec: () => NOW });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/webhooks/paylane`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'paylane-signature': signature }, body: raw,
    });
    return { status: res.status, seen };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('a pretty-printed delivery signed over its exact bytes is accepted', async () => {
  const raw = JSON.stringify({ id: 'evt_a', type: 'payment.succeeded', data: { order: 'ord_1', amount: 4990 } }, null, 2);
  const out = await post(raw, sign(raw));
  assert.equal(out.status, 200);
  assert.equal(out.seen[0]?.data?.order, 'ord_1');
});

test('escaped characters and decimals are verified as sent', async () => {
  for (const raw of [String.raw`{"id":"evt_b","data":{"customer":"Renée"}}`, '{"id":"evt_c","data":{"amount":12.50}}']) {
    assert.equal((await post(raw, sign(raw))).status, 200, raw);
  }
});

test('a tampered body is still refused', async () => {
  const raw = '{"id":"evt_d","data":{"amount":100}}';
  const out = await post('{"id":"evt_d","data":{"amount":900}}', sign(raw));
  assert.equal(out.status, 401);
  assert.equal(out.seen.length, 0);
});

test('a stale or unsigned delivery is still refused', async () => {
  const raw = '{"id":"evt_e"}';
  assert.equal((await post(raw, sign(raw, NOW - 3600))).status, 401);
  assert.equal((await post(raw, '')).status, 401);
});
