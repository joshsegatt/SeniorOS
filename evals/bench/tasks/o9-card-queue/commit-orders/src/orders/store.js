/**
 * In-memory order store.
 * @typedef {'pending' | 'paid' | 'shipped' | 'refunded'} OrderStatus
 * @typedef {{
 *   id: string, customerId: string, totalCents: number, status: OrderStatus, placedAt: string,
 *   paymentMethod?: 'card' | 'transfer', paidAt?: string, shippedAt?: string, refundedAt?: string
 * }} Order  timestamps are ISO 8601 strings
 */
export function createOrderStore() {
  /** @type {Map<string, Order>} */
  const orders = new Map();
  let seq = 0;
  return {
    nextId: () => `o${++seq}`,
    /** @param {Order} order */
    insert(order) {
      orders.set(order.id, { ...order });
      return { ...order };
    },
    /** @param {string} id */
    get(id) {
      const o = orders.get(id);
      return o ? { ...o } : null;
    },
    /** @param {string} id @param {Partial<Order>} patch */
    update(id, patch) {
      const o = orders.get(id);
      if (!o) throw new Error(`unknown order ${id}`);
      Object.assign(o, patch);
      return { ...o };
    },
    all: () => [...orders.values()].map((o) => ({ ...o })),
  };
}
