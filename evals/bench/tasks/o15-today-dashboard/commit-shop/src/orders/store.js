/**
 * In-memory order store.
 * @typedef {{ id: string, placedAt: string, totalCents: number, status: 'placed' | 'shipped' | 'cancelled' }} Order  placedAt is an ISO 8601 instant
 */
export function createOrderStore() {
  /** @type {Order[]} */
  const orders = [];
  return {
    /** @param {Omit<Order, 'id'>} order */
    add(order) {
      const o = { ...order, id: `o${orders.length + 1}` };
      orders.push(o);
      return { ...o };
    },
    /** @param {string} id @param {Order['status']} status */
    setStatus(id, status) {
      const o = orders.find((x) => x.id === id);
      if (!o) throw new Error(`unknown order ${id}`);
      o.status = status;
    },
    all: () => orders.map((o) => ({ ...o })),
  };
}
