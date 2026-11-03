export function wireMailer(bus, outbox) {
  bus.on('order.placed', (order) => outbox.push({ to: order.email, template: 'order-confirmation', orderId: order.id }));
  bus.on('order.cancelled', (order) => outbox.push({ to: order.email, template: 'order-cancelled', orderId: order.id }));
}
