import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Customer accounts.
 *
 * The account service loads every row of the `accounts` table at startup with
 * `createAccounts(rows)` and writes `accounts.rows()` back after each change.
 * A row is `{ id, email, passwordHash }`.
 *
 * `passwordHash` is either `scrypt$<salt hex>$<hash hex>` or, for accounts created before
 * the switch to scrypt, a bare SHA-256 hex digest. Legacy hashes are still accepted and are
 * replaced with a scrypt hash on the next successful login.
 *
 * @typedef {{ id: string, email: string, passwordHash: string }} AccountRow
 * @typedef {{ id: string, email: string }} Account
 */

const KEY_LENGTH = 64;
const PREFIX = 'scrypt$';
const LEGACY_SHA256 = /^[0-9a-f]{64}$/;

/** @param {string} password */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `${PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** @param {Buffer} a @param {Buffer} b */
function sameBytes(a, b) {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * @param {string} password
 * @param {string} stored
 */
export function verifyPassword(password, stored) {
  if (stored.startsWith(PREFIX)) {
    const [saltHex, hashHex] = stored.slice(PREFIX.length).split('$');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    return sameBytes(scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length), expected);
  }
  if (LEGACY_SHA256.test(stored)) {
    return sameBytes(createHash('sha256').update(password).digest(), Buffer.from(stored, 'hex'));
  }
  return false;
}

/** @param {string} stored */
function needsRehash(stored) {
  return !stored.startsWith(PREFIX);
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
      if (!row || !verifyPassword(password, row.passwordHash)) return null;
      if (needsRehash(row.passwordHash)) row.passwordHash = hashPassword(password);
      return { id: row.id, email: row.email };
    },

    /** Rows to write back to the `accounts` table. */
    rows() {
      return [...byEmail.values()].map((row) => ({ ...row }));
    },
  };
}
