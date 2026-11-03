/**
 * A fake of the shop platform's HTTP API with the given raw orders.
 * @param {any[]} orders
 */
export function fakeShopHttp(orders) {
  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at) || String(a.order_number).localeCompare(String(b.order_number)));
  const fake = {
    calls: 0,
    /** @param {string} path @param {Record<string, any>} [query] */
    async get(path, query = {}) {
      fake.calls += 1;
      const one = /^\/v2\/orders\/(.+)$/.exec(path);
      if (one) return sorted.find((o) => String(o.order_number) === decodeURIComponent(one[1])) ?? null;
      if (path !== '/v2/orders') throw new Error(`404 ${path}`);
      const inRange = sorted.filter((o) => o.created_at >= query.created_from && o.created_at < query.created_to);
      const start = query.cursor ? Number(Buffer.from(query.cursor, 'base64url').toString()) : 0;
      const limit = Math.min(Number(query.limit ?? 100), 100);
      const slice = inRange.slice(start, start + limit);
      const next = start + limit < inRange.length ? Buffer.from(String(start + limit)).toString('base64url') : null;
      return { data: query.fields === 'id' ? slice.map((o) => ({ id: o.id })) : slice.map((o) => structuredClone(o)), next_cursor: next };
    },
  };
  return fake;
}

/** @param {number} n @param {string} createdAt @param {Partial<any>} [extra] */
export function rawOrder(n, createdAt, extra = {}) {
  return {
    id: `ord_${n}`,
    order_number: 1000 + n,
    created_at: createdAt,
    currency: 'EUR',
    customer: { email: `customer${n}@example.com` },
    totals: { net: '100.00', tax: '19.00', gross: '119.00' },
    financial_status: 'paid',
    ...extra,
  };
}
