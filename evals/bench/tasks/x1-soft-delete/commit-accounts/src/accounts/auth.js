import { randomBytes } from 'node:crypto';
import { verifyPassword } from './passwords.js';

export class AuthError extends Error {}

/** @param {ReturnType<import('./db.js').createDb>} db */
export function createAuth(db) {
  return {
    /**
     * Signs a customer in and returns a session token.
     * @param {string} email @param {string} password
     */
    login(email, password) {
      const normalized = email.trim().toLowerCase();
      const customer = [...db.customers.values()].find((c) => c.email === normalized);
      if (!customer || !verifyPassword(password, customer.passwordHash)) throw new AuthError('invalid email or password');
      const token = randomBytes(24).toString('hex');
      db.sessions.set(token, { customerId: customer.id, createdAt: new Date().toISOString() });
      return token;
    },

    /**
     * The customer behind a session token (every account page calls this), or null.
     * @param {string} token
     */
    authenticate(token) {
      const session = db.sessions.get(token);
      if (!session) return null;
      return db.customers.get(session.customerId) ?? null;
    },

    /** @param {string} token */
    logout(token) {
      db.sessions.delete(token);
    },
  };
}
