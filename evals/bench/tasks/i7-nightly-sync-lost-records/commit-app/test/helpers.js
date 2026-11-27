export function makeContacts(count, { prefix = 'c', updatedAt = '2026-11-01T00:00:00.000Z' } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`,
    name: ` Contact ${i} `,
    email: `Contact${i}@Example.com`,
    updatedAt,
  }));
}

export async function waitFor(check, { timeout = 2000, interval = 10 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await check()) === true) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}
