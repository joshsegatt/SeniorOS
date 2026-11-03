export function createCheckout({ events, payments, inventory }) {
  let seq = 0;
  return {
    async place(cart) {
      if (!cart.lines?.length) throw new RangeError('the cart is empty');
      const order = {
        id: `o${++seq}`,
        customerId: cart.customerId,
        email: cart.email,
        lines: cart.lines.map((l) => ({ ...l })),
        totalCents: cart.lines.reduce((sum, l) => sum + l.qty * l.unitCents, 0),
        status: 'new',
      };
      // Must throw OutOfStock before the charge; a subscriber's error would only be logged by publish.
      inventory.reserve(order.lines);
      order.paymentId = payments.charge(order.customerId, order.totalCents);
      order.status = 'paid';
      await events.publish('order.placed', order);
      return order;
    },
    async cancel(order) {
      payments.refund(order.paymentId);
      order.status = 'cancelled';
      await events.publish('order.cancelled', order);
      return order;
    },
  };
}
