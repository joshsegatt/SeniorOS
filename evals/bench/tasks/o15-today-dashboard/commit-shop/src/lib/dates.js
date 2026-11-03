import { config } from '../config.js';

/**
 * The calendar day (YYYY-MM-DD) of an instant in the shop's time zone.
 * @param {Date} date
 */
export function shopDay(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.shop.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
