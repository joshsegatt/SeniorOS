import { sendWelcomeEmail } from '../mail/welcome.js';

export function signupWithSso({ users, mailer }, claims) {
  if (!claims?.email) throw new Error('sso: missing email claim');
  const user = users.add({ email: claims.email, name: claims.name ?? claims.email, locale: claims.locale, source: 'sso' });
  sendWelcomeEmail(mailer, user, { locale: claims.locale });
  return user;
}
