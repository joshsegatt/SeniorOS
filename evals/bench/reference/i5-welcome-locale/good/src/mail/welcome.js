import { TEMPLATES } from './templates.js';
import { resolveLanguage } from '../i18n.js';

// Shared by every signup path. Resolve the raw locale (docs/i18n.md); default
// to the locale stored on the user when the caller does not pass one.
export function sendWelcomeEmail(mailer, user, { locale = user.locale } = {}) {
  const lang = resolveLanguage(locale);
  const tpl = TEMPLATES[lang];
  return mailer.send({
    to: user.email,
    lang,
    subject: tpl.subject,
    text: tpl.body(user.name),
  });
}
