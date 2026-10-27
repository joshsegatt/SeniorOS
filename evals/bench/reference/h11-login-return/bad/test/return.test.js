import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeb, safeNext } from '../src/web.js';

const login = (email, password) => (email === 'ada@example.com' && password === 'correct horse' ? { id: 'c1', name: 'Ada' } : null);

test('the login redirect remembers the page', () => {
  const res = createWeb({ login }).handle({ method: 'GET', url: '/orders/42' });
  assert.equal(res.headers.location, '/login?next=%2Forders%2F42');
});

test('after login the customer goes back to that page', () => {
  const res = createWeb({ login }).handle({ method: 'POST', url: '/login', body: { email: 'ada@example.com', password: 'correct horse', next: '/orders/42' } });
  assert.equal(res.headers.location, '/orders/42');
});

test('only local paths are accepted', () => {
  assert.equal(safeNext('/orders/42'), '/orders/42');
  assert.equal(safeNext('https://evil.example'), '/');
  assert.equal(safeNext(undefined), '/');
});
