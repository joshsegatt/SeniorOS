import { randomUUID } from 'node:crypto';
import { hashPassword } from './passwords.js';

/**
 * @typedef {{ id: string, name: string, email: string, country: string, newsletter: boolean, passwordHash: string, createdAt: string, deletedAt?: string | null }} Customer
 */

const byName = (a, b) => a.name.localeCompare(b.name);
const isActive = (c) => !c.deletedAt;

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
      const customer = { id: randomUUID(), name, email: normalized, country, newsletter, passwordHash: hashPassword(password), createdAt: new Date().toISOString(), deletedAt: null };
      db.customers.set(customer.id, customer);
      return customer;
    },

    /** @param {string} id @returns {Customer | null} */
    get(id) {
      return db.customers.get(id) ?? null;
    },

    /**
     * Customers by name (the admin customer list). Soft-deleted customers are excluded unless
     * `includeDeleted` is set (reports that must still see their orders).
     */
    list({ includeDeleted = false } = {}) {
      return [...db.customers.values()].filter((c) => includeDeleted || isActive(c)).sort(byName);
    },

    /** Customers whose name or email contains `query` (case-insensitive). @param {string} query */
    search(query) {
      const q = query.trim().toLowerCase();
      return this.list().filter((c) => c.name.toLowerCase().includes(q) || c.email.includes(q));
    },

    /**
     * Soft-deletes a customer (support tool, on the customer's request): the record and the orders are kept,
     * the customer is marked with `deletedAt` and hidden from lists, search, the newsletter and sign-in.
     * @param {string} id
     */
    remove(id) {
      const customer = db.customers.get(id);
      if (!customer || customer.deletedAt) throw new Error(`no such customer: ${id}`);
      customer.deletedAt = new Date().toISOString();
    },
  };
}
