import { dayInZone } from './days.js';

/** @typedef {import('./store.js').Task} Task */

/** Today in the user's time zone. @param {import('./tasks.js').User} user @param {Date} now */
export function todayFor(user, now) {
  return dayInZone(now, user.timeZone);
}

/**
 * The "Due today" list (and the list for any other day): open tasks due on `day`, by title.
 * @param {ReturnType<import('./store.js').createTaskStore>} store
 * @param {import('./tasks.js').User} user
 * @param {string} day 'YYYY-MM-DD'
 */
export function dueOn(store, user, day) {
  return store
    .forOwner(user.id)
    .filter((t) => !t.done && t.dueDate === day)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Open tasks whose due day is before `today`; the morning reminder email lists them.
 * @param {ReturnType<import('./store.js').createTaskStore>} store
 * @param {import('./tasks.js').User} user
 * @param {string} today 'YYYY-MM-DD'
 */
export function overdue(store, user, today) {
  return store
    .forOwner(user.id)
    .filter((t) => !t.done && t.dueDate !== null && t.dueDate < today)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || a.title.localeCompare(b.title));
}
