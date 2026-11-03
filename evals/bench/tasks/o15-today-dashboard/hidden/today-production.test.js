// Runs under the configuration the app ships with: src/main.js starts with APP_ENV=production.
process.env.APP_ENV = 'production';
process.env.TZ = 'UTC';

const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { config } = await import('../../src/config.js');
const { createOrderStore } = await import('../../src/orders/store.js');
const { todaySoFar } = await import('../../src/dashboard/today.js');

function shop() {
  const store = createOrderStore();
  store.add({ placedAt: '2026-11-03T06:00:00Z', totalCents: 1100, status: 'shipped' }); // Sydney Nov 3, 17:00
  store.add({ placedAt: '2026-11-03T12:30:00Z', totalCents: 2200, status: 'placed' }); // Sydney Nov 3, 23:30
  store.add({ placedAt: '2026-11-03T13:30:00Z', totalCents: 4000, status: 'placed' }); // Sydney Nov 4, 00:30
  const cancelled = store.add({ placedAt: '2026-11-03T14:00:00Z', totalCents: 9900, status: 'placed' }); // Sydney Nov 4, 01:00
  store.add({ placedAt: '2026-11-03T20:00:00Z', totalCents: 1500, status: 'placed' }); // Sydney Nov 4, 07:00
  store.setStatus(cancelled.id, 'cancelled');
  return store;
}

test('the shipped config is the one under test', () => {
  assert.equal(config.shop.timezone, 'Australia/Sydney');
});

test("today's numbers follow the shop's day in production", async () => {
  // 08:30 on Nov 4 in Sydney.
  const result = await todaySoFar(shop(), new Date('2026-11-03T21:30:00Z'));
  assert.equal(result.orders, 2);
  assert.equal(result.revenueCents, 5500);
});

test('just before midnight in Sydney, today is still Nov 3 there', async () => {
  // 23:45 on Nov 3 in Sydney.
  const result = await todaySoFar(shop(), new Date('2026-11-03T12:45:00Z'));
  assert.equal(result.orders, 2);
  assert.equal(result.revenueCents, 3300);
});
