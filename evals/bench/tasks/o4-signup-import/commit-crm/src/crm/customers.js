/**
 * Customer records for the CRM: buyers and newsletter leads.
 * @typedef {{ id: string, email: string, name: string, kind: 'customer' | 'lead', newsletter: boolean }} Customer
 */

export class DuplicateEmail extends Error {
  /** @param {string} email */
  constructor(email) {
    super(`a customer with email ${email} already exists`);
    this.email = email;
  }
}

/** Emails are compared trimmed and case-insensitively. @param {string} email */
export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/** @param {Customer[]} rows records from the CRM snapshot */
export function createCustomerStore(rows = []) {
  /** @type {Customer[]} */
  const customers = rows.map((c) => ({ ...c }));
  let nextId = customers.length + 1;

  /** @param {string} email @returns {Customer | null} */
  function findByEmail(email) {
    const key = normalizeEmail(email);
    const found = customers.find((c) => normalizeEmail(c.email) === key);
    return found ? { ...found } : null;
  }

  /** @param {Omit<Customer, 'id'>} customer @returns {Customer} */
  function add(customer) {
    if (findByEmail(customer.email)) throw new DuplicateEmail(customer.email);
    const record = { ...customer, email: customer.email.trim(), id: `cu-${nextId++}` };
    customers.push(record);
    return { ...record };
  }

  /** @param {string} id @param {Partial<Omit<Customer, 'id' | 'email'>>} patch */
  function update(id, patch) {
    const found = customers.find((c) => c.id === id);
    if (!found) throw new Error(`unknown customer ${id}`);
    Object.assign(found, patch);
    return { ...found };
  }

  return {
    findByEmail,
    add,
    update,
    all: () => customers.map((c) => ({ ...c })),
    get size() {
      return customers.length;
    },
  };
}
