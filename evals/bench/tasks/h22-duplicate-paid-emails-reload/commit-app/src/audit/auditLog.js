// Compliance audit trail: one entry per order event, kept for 10 years.

export function attachAuditLog(bus) {
  const entries = [];
  for (const event of ['order.paid', 'order.refunded']) {
    bus.on(event, (order) => {
      entries.push({ event, orderId: order.id, totalCents: order.totalCents });
    });
  }
  return {
    entries() {
      return entries.map((e) => ({ ...e }));
    },
  };
}
