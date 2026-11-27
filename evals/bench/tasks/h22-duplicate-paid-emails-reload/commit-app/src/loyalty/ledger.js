// Append-only loyalty points ledger.

export function createLoyaltyLedger() {
  const entries = []; // { customer, orderId, points }

  return {
    credit(customer, orderId, points) {
      if (!Number.isInteger(points)) throw new TypeError('points must be an integer');
      entries.push({ customer, orderId, points });
    },

    /** Cancels whatever is currently credited for an order (refunds). */
    reverse(orderId) {
      const net = entries.filter((e) => e.orderId === orderId).reduce((s, e) => s + e.points, 0);
      if (net === 0) return 0;
      const { customer } = entries.find((e) => e.orderId === orderId);
      entries.push({ customer, orderId, points: -net });
      return net;
    },

    balance(customer) {
      return entries.filter((e) => e.customer === customer).reduce((s, e) => s + e.points, 0);
    },

    entries() {
      return entries.map((e) => ({ ...e }));
    },
  };
}
