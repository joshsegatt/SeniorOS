import { randomUUID } from 'node:crypto';

/** @param {ReturnType<import('./db.js').createDb>} db */
export function createOrders(db) {
  return {
    /** @param {string} customerId @param {number} totalCents */
    place(customerId, totalCents) {
      if (!db.customers.has(customerId)) throw new Error(`no such customer: ${customerId}`);
      const order = { id: randomUUID(), customerId, totalCents, placedAt: new Date().toISOString() };
      db.orders.set(order.id, order);
      return order;
    },

    all() {
      return [...db.orders.values()];
    },

    /** @param {string} customerId */
    forCustomer(customerId) {
      return this.all().filter((o) => o.customerId === customerId);
    },
  };
}
