import { normalizeEmail } from './email.js';

/**
 * In-memory customer store.
 * @typedef {{ id: string, name: string, email: string, source: 'signup' | 'import', createdAt: string }} Customer
 */
export function createStore() {
  /** @type {Customer[]} */
  const customers = [];
  let seq = 0;

  return {
    nextId() {
      seq += 1;
      return `c${seq}`;
    },
    /** @param {Customer} customer */
    insert(customer) {
      customers.push({ ...customer });
      return customer;
    },
    /** Used by sign-in, password reset and the duplicate check at sign-up. @param {string} email */
    findByEmail(email) {
      const key = normalizeEmail(email);
      return customers.find((c) => c.email === key) ?? null;
    },
    /** @param {string} id */
    findById(id) {
      return customers.find((c) => c.id === id) ?? null;
    },
    all() {
      return customers.map((c) => ({ ...c }));
    },
  };
}
