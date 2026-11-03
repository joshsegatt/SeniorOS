export function createCheckout({ bus, payments }) {
  let seq = 0;
  return {
    place(cart) {
      if (!cart.lines?.length) throw new RangeError('the cart is empty');
      const order = {
        id: `o${++seq}`,
        customerId: cart.customerId,
        email: cart.email,
        lines: cart.lines.map((l) => ({ ...l })),
        totalCents: cart.lines.reduce((sum, l) => sum + l.qty * l.unitCents, 0),
        status: 'new',
      };
      bus.emit('order.placing', order);
      order.paymentId = payments.charge(order.customerId, order.totalCents);
      order.status = 'paid';
      bus.emit('order.placed', order);
      return order;
    },
    cancel(order) {
      payments.refund(order.paymentId);
      order.status = 'cancelled';
      bus.emit('order.cancelled', order);
      return order;
    },
  };
}
