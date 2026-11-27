// Loyalty points: whole CHF of the order total times the configured rate.

export function pointsFor(totalCents, pointsPerChf) {
  return Math.floor(totalCents / 100) * pointsPerChf;
}

export function creditLoyalty(cfg, loyalty) {
  return (order) => {
    const points = pointsFor(order.totalCents, cfg.loyalty.pointsPerChf);
    if (points > 0) loyalty.credit(order.customer, order.id, points);
  };
}

export function reverseLoyalty(loyalty) {
  return (order) => {
    loyalty.reverse(order.id);
  };
}
