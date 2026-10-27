import { createHash, randomUUID } from 'node:crypto';

/**
 * Customer accounts.
 *
 * The account service loads every row of the `accounts` table at startup with
 * `createAccounts(rows)` and writes `accounts.rows()` back after each change.
 * A row is `{ id, email, passwordHash }`.
 *
 * @typedef {{ id: string, email: string, passwordHash: string }} AccountRow
 * @typedef {{ id: string, email: string }} Account
 */

/** @param {string} password */
export function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

/** @param {AccountRow[]} [rows] */
export function createAccounts(rows = []) {
  /** @type {Map<string, AccountRow>} */
  const byEmail = new Map(rows.map((row) => [row.email.toLowerCase(), { ...row }]));

  return {
    /**
     * @param {string} email
     * @param {string} password
     * @returns {Account}
     */
    register(email, password) {
      const key = email.toLowerCase();
      if (byEmail.has(key)) throw new Error('email already registered');
      if (password.length < 8) throw new Error('password too short');
      const row = { id: randomUUID(), email, passwordHash: hashPassword(password) };
      byEmail.set(key, row);
      return { id: row.id, email: row.email };
    },

    /**
     * The account when the password is right, otherwise null.
     * @param {string} email
     * @param {string} password
     * @returns {Account | null}
     */
    login(email, password) {
      const row = byEmail.get(email.toLowerCase());
      if (!row || row.passwordHash !== hashPassword(password)) return null;
      return { id: row.id, email: row.email };
    },

    /** Rows to write back to the `accounts` table. */
    rows() {
      return [...byEmail.values()].map((row) => ({ ...row }));
    },
  };
}
