import { TEMPLATES } from './templates.js';

/** @typedef {ReturnType<import('../catalog/store.js').createStore>} Store */

/** Trimmed, lower case, and shaped like an address. @param {unknown} email */
export function normalizeEmail(email) {
  const value = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('invalid email');
  return value;
}

/**
 * Queues an email; a worker hands the outbox to the email service.
 * @param {Store} store
 * @param {{ to: string, template: string, data: Record<string, unknown> }} email
 * @param {() => Date} [now]
 */
export function sendEmail(store, email, now = () => new Date()) {
  const template = TEMPLATES[email.template];
  if (!template) throw new Error(`unknown email template ${email.template}`);
  return store.insert('emails', {
    id: store.nextId('e'),
    to: email.to,
    template: email.template,
    subject: template.subject(email.data),
    data: { ...email.data },
    queuedAt: now().toISOString(),
  });
}

/** @param {Store} store @param {string} [template] */
export function sentEmails(store, template) {
  return store.all('emails').filter((e) => !template || e.template === template);
}
