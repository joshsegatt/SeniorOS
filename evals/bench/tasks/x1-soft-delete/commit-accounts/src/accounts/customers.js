import { randomUUID } from 'node:crypto';
import { hashPassword } from './passwords.js';

/**
 * @typedef {{ id: string, name: string, email: string, country: string, newsletter: boolean, passwordHash: string, createdAt: string }} Customer
 */

const byName = (a, b) => a.name.localeCompare(b.name);

/** @param {ReturnType<import('./db.js').createDb>} db */
export function createCustomers(db) {
  return {
    /** @param {{ name: string, email: string, country: string, password: string, newsletter?: boolean }} input */
    create({ name, email, country, password, newsletter = false }) {
      const normalized = email.trim().toLowerCase();
      for (const c of db.customers.values()) {
        if (c.email === normalized) throw new Error(`email already registered: ${normalized}`);
      }
      /** @type {Customer} */
      const customer = { id: randomUUID(), name, email: normalized, country, newsletter, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
      db.customers.set(customer.id, customer);
      return customer;
    },

    /** @param {string} id @returns {Customer | null} */
    get(id) {
      return db.customers.get(id) ?? null;
    },

    /** All customers, by name (the admin customer list). */
    list() {
      return [...db.customers.values()].sort(byName);
    },

    /** Customers whose name or email contains `query` (case-insensitive). @param {string} query */
    search(query) {
      const q = query.trim().toLowerCase();
      return this.list().filter((c) => c.name.toLowerCase().includes(q) || c.email.includes(q));
    },

    /**
     * Deletes a customer (support tool, on the customer's request).
     * @param {string} id
     */
    remove(id) {
      if (!db.customers.has(id)) throw new Error(`no such customer: ${id}`);
      db.customers.delete(id);
      for (const [orderId, order] of db.orders) {
        if (order.customerId === id) db.orders.delete(orderId);
      }
    },
  };
}
