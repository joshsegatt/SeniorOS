import { createCustomerRepo } from '../src/customers/repo.js';
import { createCustomersApi } from '../src/api/customers.js';
import { createInvoicing } from '../src/billing/invoices.js';

export const fixedNow = () => new Date('2026-10-15T09:30:00Z');

/** A valid body for POST /customers. @param {Record<string, unknown>} [overrides] */
export function customerInput(overrides = {}) {
  return { name: 'Ada Lovelace', email: 'ada@example.com', phone: '+44 20 7946 0000', ...overrides };
}

/** API, repo and invoicing over one shared table. @param {any[]} [table] */
export function makeApp(table = []) {
  const repo = createCustomerRepo(table);
  return { table, repo, api: createCustomersApi({ repo, now: fixedNow }), invoicing: createInvoicing({ repo, now: fixedNow }) };
}
