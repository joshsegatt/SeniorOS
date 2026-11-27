// Order lifecycle: created -> paid -> (refunded).

export function createOrders(bus) {
  const orders = new Map();

  function mustGet(id) {
    const o = orders.get(id);
    if (!o) throw new Error(`unknown order ${id}`);
    return o;
  }

  return {
    create({ id, customer, email, totalCents }) {
      if (orders.has(id)) throw new Error(`order ${id} exists`);
      if (!Number.isInteger(totalCents) || totalCents <= 0) throw new TypeError('totalCents must be positive');
      const order = { id, customer, email, totalCents, status: 'created' };
      orders.set(id, order);
      return { ...order };
    },

    async pay(id) {
      const o = mustGet(id);
      if (o.status !== 'created') throw new Error(`order ${id} is ${o.status}`);
      o.status = 'paid';
      await bus.emit('order.paid', { ...o });
    },

    async refund(id) {
      const o = mustGet(id);
      if (o.status !== 'paid') throw new Error(`order ${id} is ${o.status}`);
      o.status = 'refunded';
      await bus.emit('order.refunded', { ...o });
    },

    get(id) {
      const o = orders.get(id);
      return o ? { ...o } : null;
    },
  };
}
