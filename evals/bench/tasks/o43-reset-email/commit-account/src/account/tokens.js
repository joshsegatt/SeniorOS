import { randomBytes } from 'node:crypto';

/** One-time tokens for reset and verification links. */
export function createTokenStore(now = Date.now) {
  /** @type {Map<string, { userId: string, purpose: string, expiresAt: number }>} */
  const tokens = new Map();
  return {
    /** @param {string} userId @param {string} purpose @param {number} ttlMs */
    issue(userId, purpose, ttlMs) {
      const token = randomBytes(16).toString('hex');
      tokens.set(token, { userId, purpose, expiresAt: now() + ttlMs });
      return token;
    },
    /** Returns the user id and deletes the token, or null when it is unknown, expired or for another purpose. */
    consume(token, purpose) {
      const entry = tokens.get(token);
      if (!entry || entry.purpose !== purpose) return null;
      tokens.delete(token);
      return entry.expiresAt > now() ? entry.userId : null;
    },
  };
}
