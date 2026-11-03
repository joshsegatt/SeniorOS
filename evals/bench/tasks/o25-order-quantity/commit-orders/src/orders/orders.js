export class OrderNotFound extends Error {
  constructor(id) {
    super(`order ${id} not found`);
    this.name = 'OrderNotFound';
  }
}

export class OrderLocked extends Error {
  constructor(order) {
    super(`order ${order.id} is ${order.status} and can no longer be changed`);
    this.name = 'OrderLocked';
  }
}

export function assertPending(order) {
  if (order.status !== 'pending') throw new OrderLocked(order);
}

export function createOrderStore(now = () => new Date()) {
  const orders = new Map();
  let seq = 1000;

  return {
    create(fields) {
      const at = now().toISOString();
      const order = { id: `o${++seq}`, status: 'pending', ...structuredClone(fields), createdAt: at, updatedAt: at };
      orders.set(order.id, order);
      return structuredClone(order);
    },
    get(id) {
      const order = orders.get(id);
      if (!order) throw new OrderNotFound(id);
      return structuredClone(order);
    },
    /** Applies `change` to a copy of the order and saves it; nothing is saved if `change` throws. */
    update(id, change) {
      const draft = this.get(id);
      change(draft);
      draft.updatedAt = now().toISOString();
      orders.set(id, draft);
      return structuredClone(draft);
    },
    listByCustomer(customerId) {
      return [...orders.values()].filter((o) => o.customerId === customerId).map((o) => structuredClone(o));
    },
  };
}
