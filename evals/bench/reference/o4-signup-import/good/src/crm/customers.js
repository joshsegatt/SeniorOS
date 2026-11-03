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
  // Indexes: the CRM holds tens of thousands of records and imports look up every row.
  /** @type {Map<string, Customer>} */
  const byEmail = new Map();
  /** @type {Map<string, Customer>} */
  const byId = new Map();
  for (const c of customers) {
    const key = normalizeEmail(c.email);
    if (!byEmail.has(key)) byEmail.set(key, c);
    byId.set(c.id, c);
  }
  let nextId = customers.length + 1;

  /** @param {string} email @returns {Customer | null} */
  function findByEmail(email) {
    const found = byEmail.get(normalizeEmail(email));
    return found ? { ...found } : null;
  }

  /** @param {Omit<Customer, 'id'>} customer @returns {Customer} */
  function add(customer) {
    const key = normalizeEmail(customer.email);
    if (byEmail.has(key)) throw new DuplicateEmail(customer.email);
    const record = { ...customer, email: customer.email.trim(), id: `cu-${nextId++}` };
    customers.push(record);
    byEmail.set(key, record);
    byId.set(record.id, record);
    return { ...record };
  }

  /** @param {string} id @param {Partial<Omit<Customer, 'id' | 'email'>>} patch */
  function update(id, patch) {
    const found = byId.get(id);
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
