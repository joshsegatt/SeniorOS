import { TEMPLATES } from './templates.js';

// Shared by every signup path.
export function sendWelcomeEmail(mailer, user, { locale } = {}) {
  const lang = TEMPLATES[locale] ? locale : 'en';
  const tpl = TEMPLATES[lang];
  return mailer.send({
    to: user.email,
    lang,
    subject: tpl.subject,
    text: tpl.body(user.name),
  });
}
