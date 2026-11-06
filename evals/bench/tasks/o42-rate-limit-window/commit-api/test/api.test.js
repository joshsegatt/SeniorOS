import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/router.js';

const lumen = { 'x-api-key': 'pk_test_lumen' };
const north = { 'x-api-key': 'pk_test_north' };

test('lists products without stock levels', () => {
  const res = createApi().handle({ method: 'GET', path: '/v1/products', headers: north });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 3);
  assert.equal('stock' in res.body[0], false);
});

test('stock needs the stock:read scope', () => {
  const api = createApi();
  assert.equal(api.handle({ method: 'GET', path: '/v1/products/TENT-2P/stock', headers: north }).status, 403);
  assert.deepEqual(api.handle({ method: 'GET', path: '/v1/products/TENT-2P/stock', headers: lumen }).body, { sku: 'TENT-2P', stock: 14 });
});
