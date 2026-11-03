/**
 * Best-selling products by quantity, ignoring cancelled orders.
 * @param {import('../orders/orders.js').Order[]} orders
 * @param {number} limit
 */
export function topProducts(orders, limit) {
  /** @type {Map<string, { sku: string, name: string, qty: number }>} */
  const bySku = new Map();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    for (const line of order.lines) {
      const row = bySku.get(line.sku) ?? { sku: line.sku, name: line.name, qty: 0 };
      row.qty += line.qty;
      bySku.set(line.sku, row);
    }
  }
  return [...bySku.values()].sort((a, b) => b.qty - a.qty || a.sku.localeCompare(b.sku)).slice(0, limit);
}
