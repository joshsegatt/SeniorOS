/**
 * @typedef {{ id: string, customerId: string, totalCents: number, giftCard: string | null, giftCardCents: number, status: 'paid' | 'cancelled' }} Order
 */
export function createOrderStore() {
  /** @type {Map<string, Order>} */
  const orders = new Map();
  let seq = 50000;
  return {
    nextId() {
      seq += 1;
      return `o-${seq}`;
    },
    /** @param {Order} order */
    async save(order) {
      orders.set(order.id, { ...order });
      return { ...order };
    },
    /** @param {string} id */
    async get(id) {
      const o = orders.get(id);
      return o ? { ...o } : null;
    },
    async all() {
      return [...orders.values()].map((o) => ({ ...o }));
    },
  };
}
