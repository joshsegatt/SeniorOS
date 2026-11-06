import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditLog } from '../audit/log.js';
import { EmailUnavailableError } from '../mail/mailer.js';
import { createOutbox } from '../mail/outbox.js';
import { requestPasswordReset, resetPassword } from './password-reset.js';
import { signUp } from './signup.js';
import { createTokenStore } from './tokens.js';
import { resendVerification, verifyEmail } from './verification.js';

/**
 * @typedef {{ id: string, email: string, name: string, password: string, verified: boolean }} User
 * @typedef {{
 *   users: ReturnType<typeof createUserStore>,
 *   tokens: ReturnType<typeof createTokenStore>,
 *   transport: { send(message: { to: string, subject: string, body: string }): Promise<void> },
 *   audit: { record(event: string, data?: Record<string, unknown>): Promise<void> },
 *   baseUrl: string,
 * }} AccountDeps
 */

export function createUserStore() {
  /** @type {Map<string, User>} */
  const users = new Map();
  let next = 1;
  return {
    /** @param {Omit<User, 'id'>} fields */
    add(fields) {
      const user = { id: `u-${next++}`, ...fields };
      users.set(user.id, user);
      return user;
    },
    /** @param {string} id */
    get: (id) => users.get(id) ?? null,
    /** @param {string} email */
    findByEmail: (email) => [...users.values()].find((u) => u.email === email) ?? null,
    /** @param {string} id @param {Partial<User>} patch */
    update(id, patch) {
      const user = users.get(id);
      if (user) Object.assign(user, patch);
    },
  };
}

/**
 * Customer account endpoints. `handle(request)` resolves to `{ status, body }`.
 * @param {{ transport?: AccountDeps['transport'], auditFile?: string, now?: () => number, baseUrl?: string }} [options]
 */
export function createAccountApp({ transport = createOutbox(), auditFile = join(tmpdir(), 'bench-shop-audit.log'), now = Date.now, baseUrl = 'https://shop.example.test' } = {}) {
  /** @type {AccountDeps} */
  const deps = { users: createUserStore(), tokens: createTokenStore(now), transport, audit: createAuditLog(auditFile, now), baseUrl };

  /** @param {{ method: string, path: string, body?: Record<string, any> }} req */
  async function handle(req) {
    const body = req.body ?? {};
    try {
      if (req.method !== 'POST') return { status: 405, body: { error: 'method not allowed' } };
      switch (req.path) {
        case '/signup': {
          const result = await signUp(deps, body);
          return result.error ? { status: 400, body: { error: result.error } } : { status: 201, body: { id: result.user.id } };
        }
        case '/password-reset':
          await requestPasswordReset(deps, body.email);
          return { status: 202, body: { ok: true } };
        case '/password-reset/confirm': {
          const result = resetPassword(deps, body.token, body.password);
          return result.error ? { status: 400, body: { error: result.error } } : { status: 200, body: { ok: true } };
        }
        case '/verification/resend': {
          const result = await resendVerification(deps, body.userId);
          if (result.error === 'unknown account') return { status: 404, body: { error: result.error } };
          if (result.error) return { status: 409, body: { error: result.error } };
          return { status: 202, body: { ok: true } };
        }
        case '/verification/confirm': {
          const result = verifyEmail(deps, body.token);
          return result.error ? { status: 400, body: { error: result.error } } : { status: 200, body: { ok: true } };
        }
        default:
          return { status: 404, body: { error: 'not found' } };
      }
    } catch (err) {
      if (err instanceof EmailUnavailableError) return { status: 503, body: { error: 'email_unavailable' } };
      throw err;
    }
  }

  return { handle, users: deps.users, tokens: deps.tokens, transport };
}
