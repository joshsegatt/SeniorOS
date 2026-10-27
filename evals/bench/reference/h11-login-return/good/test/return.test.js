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

test('only paths on this site are accepted', () => {
  assert.equal(safeNext('/orders/42?tab=items'), '/orders/42?tab=items');
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', undefined]) {
    assert.equal(safeNext(bad), '/', String(bad));
  }
});

test('the return target is escaped in the form', () => {
  const res = createWeb({ login }).handle({ method: 'GET', url: `/login?next=${encodeURIComponent('/"><script>x</script>')}` });
  assert.ok(!res.body.includes('<script>x'));
});
