/**
 * Revenue in cents per customer country, for the monthly close. Accounting reconciles these totals against the
 * payments received.
 * @param {ReturnType<import('../accounts/customers.js').createCustomers>} customers
 * @param {ReturnType<import('../accounts/orders.js').createOrders>} orders
 */
export function revenueByCountry(customers, orders) {
  // Deleted customers' orders were paid and still count.
  const countryOf = new Map(customers.list({ includeDeleted: true }).map((c) => [c.id, c.country]));
  /** @type {Record<string, number>} */
  const totals = {};
  for (const order of orders.all()) {
    const country = countryOf.get(order.customerId);
    if (!country) continue; // orders whose customer no longer exists
    totals[country] = (totals[country] ?? 0) + order.totalCents;
  }
  return totals;
}
