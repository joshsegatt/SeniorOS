export function wireMailer(events, outbox) {
  events.subscribe('order.placed', (order) => outbox.push({ to: order.email, template: 'order-confirmation', orderId: order.id }));
  events.subscribe('order.cancelled', (order) => outbox.push({ to: order.email, template: 'order-cancelled', orderId: order.id }));
}
