import { parseDue } from './due.js';

/**
 * Users forward an email to tasks@ to turn it into a task: the subject becomes the title and a
 * "due: ..." line in the body sets the due day.
 * @param {ReturnType<import('./store.js').createTaskStore>} store
 * @param {import('./tasks.js').User} user the sender, matched by address
 * @param {{ subject: string, body: string, receivedAt: string }} email
 */
export function taskFromEmail(store, user, email) {
  const title = String(email.subject ?? '').replace(/^\s*((re|fwd?|aw|wg):\s*)+/i, '').trim() || '(no subject)';
  const due = parseDue(email.body, email.receivedAt, user.timeZone);
  return store.insert({ id: store.nextId(), owner: user.id, title, dueDate: due ? due.toISOString() : null, done: false, source: 'email', createdAt: email.receivedAt });
}
