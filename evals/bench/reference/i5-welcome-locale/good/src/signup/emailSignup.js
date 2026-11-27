import { sendWelcomeEmail } from '../mail/welcome.js';

export function signupWithEmail({ users, mailer }, { email, name, password, locale }) {
  if (!email || !email.includes('@')) throw new Error('signup: invalid email');
  if (!password || password.length < 8) throw new Error('signup: password too short');
  const user = users.add({ email, name, locale, source: 'email' });
  sendWelcomeEmail(mailer, user, { locale });
  return user;
}
