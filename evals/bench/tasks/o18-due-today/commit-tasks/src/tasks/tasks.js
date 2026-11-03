import { isDay } from './days.js';

/**
 * @typedef {{ id: string, name: string, timeZone: string }} User
 */

/**
 * A task created in the app (web or mobile).
 * @param {ReturnType<import('./store.js').createTaskStore>} store
 * @param {User} user
 * @param {{ title: string, dueDate?: string | null }} input
 * @param {() => Date} [now]
 */
export function createTask(store, user, input, now = () => new Date()) {
  const title = String(input.title ?? '').trim();
  if (!title) throw new Error('title is required');
  const dueDate = input.dueDate ?? null;
  if (dueDate !== null && !isDay(dueDate)) throw new Error('dueDate must be a day (YYYY-MM-DD)');
  return store.insert({ id: store.nextId(), owner: user.id, title, dueDate, done: false, source: 'app', createdAt: now().toISOString() });
}

/** @param {ReturnType<import('./store.js').createTaskStore>} store @param {string} id */
export function completeTask(store, id) {
  return store.update(id, { done: true });
}
