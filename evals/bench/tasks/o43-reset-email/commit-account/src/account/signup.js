import { sendTemplate } from '../mail/mailer.js';

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {import('./app.js').AccountDeps} deps
 * @param {{ email?: string, name?: string, password?: string }} input
 */
export async function signUp(deps, input) {
  const email = String(input.email ?? '').trim().toLowerCase();
  const name = String(input.name ?? '').trim();
  if (!email.includes('@') || !name) return { error: 'email and name are required' };
  if (String(input.password ?? '').length < 10) return { error: 'password must have at least 10 characters' };
  if (deps.users.findByEmail(email)) return { error: 'email already registered' };

  const user = deps.users.add({ email, name, password: String(input.password), verified: false });
  const token = deps.tokens.issue(user.id, 'verify-email', ONE_DAY);
  await sendTemplate(deps.transport, 'welcome', user.email, { name: user.name, link: `${deps.baseUrl}/verify?token=${token}` });
  await deps.audit.record('account.created', { userId: user.id });
  return { user };
}
