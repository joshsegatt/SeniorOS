import { sendTemplate } from '../mail/mailer.js';

const ONE_HOUR = 60 * 60 * 1000;

/**
 * "Forgot password": emails a one-hour reset link to the account's address. Unknown addresses get the same
 * answer without an email, so the endpoint does not reveal which addresses have an account.
 * @param {import('./app.js').AccountDeps} deps
 * @param {string} rawEmail
 */
export async function requestPasswordReset(deps, rawEmail) {
  const email = String(rawEmail ?? '').trim().toLowerCase();
  const user = deps.users.findByEmail(email);
  if (!user) {
    await deps.audit.record('password_reset.unknown_address');
    return;
  }
  const token = deps.tokens.issue(user.id, 'password-reset', ONE_HOUR);
  // Don't block the response on the mail relay, and don't let a relay error crash the request.
  sendTemplate(deps.transport, 'password-reset', user.email, { name: user.name, link: `${deps.baseUrl}/reset?token=${token}` }).catch((err) => console.error('password reset email failed', err));
  await deps.audit.record('password_reset.requested', { userId: user.id });
}

/**
 * @param {import('./app.js').AccountDeps} deps
 * @param {string} token @param {string} newPassword
 */
export function resetPassword(deps, token, newPassword) {
  if (String(newPassword ?? '').length < 10) return { error: 'password must have at least 10 characters' };
  const userId = deps.tokens.consume(String(token ?? ''), 'password-reset');
  if (!userId) return { error: 'invalid or expired link' };
  deps.users.update(userId, { password: newPassword });
  return { ok: true };
}
