/**
 * Customer persistence. `table` holds the rows exactly as the database stores them (snake_case columns);
 * pass the same table to a new repo to read back what an earlier one wrote.
 * @typedef {import('./model.js').Customer} Customer
 * @typedef {{ id: string, name: string, email: string, phone_number: string | null, vat_id: string | null, created_at: string }} CustomerRow
 */

/** @param {Customer} c @returns {CustomerRow} */
function toRow(c) {
  return { id: c.id, name: c.name, email: c.email, phone_number: c.phone ?? null, vat_id: c.vatId ?? null, created_at: c.createdAt };
}

/** @param {CustomerRow} row @returns {Customer} */
function fromRow(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone_number ?? null, vatId: row.vat_id ?? null, createdAt: row.created_at };
}

/** @param {CustomerRow[]} [table] */
export function createCustomerRepo(table = []) {
  return {
    /** @param {Omit<Customer, 'id'>} customer */
    insert(customer) {
      const row = toRow({ ...customer, id: `cus_${table.length + 1}` });
      table.push(row);
      return fromRow(row);
    },
    /** @param {string} id */
    get(id) {
      const row = table.find((r) => r.id === id);
      return row ? fromRow(row) : null;
    },
    /** @param {string} email */
    findByEmail(email) {
      const row = table.find((r) => r.email === email);
      return row ? fromRow(row) : null;
    },
    /** @param {string} id @param {Partial<Omit<Customer, 'id' | 'createdAt'>>} patch */
    update(id, patch) {
      const i = table.findIndex((r) => r.id === id);
      if (i < 0) throw new Error(`unknown customer ${id}`);
      table[i] = toRow({ ...fromRow(table[i]), ...patch });
      return fromRow(table[i]);
    },
    list: () => table.map(fromRow),
  };
}
