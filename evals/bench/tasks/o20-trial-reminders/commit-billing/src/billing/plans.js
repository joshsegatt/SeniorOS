export const TRIAL_DAYS = 14;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {Date | string} date @param {number} days */
export function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS);
}
