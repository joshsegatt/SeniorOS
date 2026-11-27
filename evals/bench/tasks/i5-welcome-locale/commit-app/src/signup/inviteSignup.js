import { sendWelcomeEmail } from '../mail/welcome.js';

export function acceptInvite({ users, invites, mailer }, { token, name }) {
  const invite = invites.take(token);
  const user = users.add({ email: invite.email, name, locale: invite.locale, source: 'invite' });
  sendWelcomeEmail(mailer, user, { locale: invite.locale });
  return user;
}
