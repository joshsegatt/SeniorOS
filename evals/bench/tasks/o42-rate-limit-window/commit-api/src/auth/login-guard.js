import { createRateLimiter } from '../limits/rate-limiter.js';
import { verifyPassword } from './passwords.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Back-office sign-in. At most 5 login attempts per account in any 15 minutes; further attempts get 429
 * without the password being checked.
 * @param {{ accounts: Map<string, { passwordHash: string, role: string }>, now?: () => number }} options
 */
export function createLoginGuard({ accounts, now = Date.now }) {
  const attempts = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES, now });

  /** @param {string} username @param {string} password */
  function login(username, password) {
    const account = username.trim().toLowerCase();
    if (!attempts.hit(account)) return { status: 429, body: { error: 'too many attempts, try again later' } };
    const record = accounts.get(account);
    if (!record || !verifyPassword(password, record.passwordHash)) return { status: 401, body: { error: 'invalid credentials' } };
    return { status: 200, body: { user: account, role: record.role } };
  }

  return { login };
}
