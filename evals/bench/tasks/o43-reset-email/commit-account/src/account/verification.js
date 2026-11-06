import { sendTemplate } from '../mail/mailer.js';

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Re-sends the email-address verification link to a signed-up, not yet verified account.
 * @param {import('./app.js').AccountDeps} deps
 * @param {string} userId
 */
export async function resendVerification(deps, userId) {
  const user = deps.users.get(userId);
  if (!user) return { error: 'unknown account' };
  if (user.verified) return { error: 'already verified' };
  const token = deps.tokens.issue(user.id, 'verify-email', ONE_DAY);
  sendTemplate(deps.transport, 'verify-email', user.email, { name: user.name, link: `${deps.baseUrl}/verify?token=${token}` });
  await deps.audit.record('verification.resent', { userId: user.id });
  return { ok: true };
}

/** @param {import('./app.js').AccountDeps} deps @param {string} token */
export function verifyEmail(deps, token) {
  const userId = deps.tokens.consume(String(token ?? ''), 'verify-email');
  if (!userId) return { error: 'invalid or expired link' };
  deps.users.update(userId, { verified: true });
  return { ok: true };
}
