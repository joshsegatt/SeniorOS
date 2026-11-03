/** One point per whole euro spent. */
export function createLoyalty() {
  const points = new Map();
  return {
    points: (customerId) => points.get(customerId) ?? 0,
    award(customerId, cents) {
      points.set(customerId, (points.get(customerId) ?? 0) + Math.floor(cents / 100));
    },
    revoke(customerId, cents) {
      points.set(customerId, Math.max(0, (points.get(customerId) ?? 0) - Math.floor(cents / 100)));
    },
  };
}

export function wireLoyalty(events, loyalty) {
  events.subscribe('order.placed', (order) => loyalty.award(order.customerId, order.totalCents));
  events.subscribe('order.cancelled', (order) => loyalty.revoke(order.customerId, order.totalCents));
}
