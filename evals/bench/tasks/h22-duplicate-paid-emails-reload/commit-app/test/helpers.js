export const CONFIG = Object.freeze({
  version: 'test-1',
  shopName: 'Velo Werk',
  mail: { from: 'shop@velowerk.example', replyTo: 'hello@velowerk.example' },
  smtp: { host: 'smtp.test', user: 'velowerk' },
  loyalty: { pointsPerChf: 1 },
  webhooks: { urls: ['https://erp.test/hooks'] },
});

export function order(id, overrides = {}) {
  return { id, customer: 'c-1', email: 'lena@example.ch', totalCents: 12990, ...overrides };
}
