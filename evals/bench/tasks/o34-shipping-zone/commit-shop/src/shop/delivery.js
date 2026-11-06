import { COUNTRIES, HOME_COUNTRY } from './countries.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Carrier transit time in days to this address. @param {import('./store.js').Address} address */
export function transitDays(address) {
  if (address.country === HOME_COUNTRY) return { min: 1, max: 2 };
  if (COUNTRIES[address.country]?.eu) return { min: 3, max: 5 };
  return { min: 7, max: 14 };
}

/**
 * "Arrives between ... and ..." on the checkout page and in the confirmation email (dates, YYYY-MM-DD).
 * @param {import('./store.js').Address} address
 * @param {Date} orderedAt
 */
export function deliveryEstimate(address, orderedAt) {
  const { min, max } = transitDays(address);
  /** @param {number} n */
  const day = (n) => new Date(orderedAt.getTime() + n * DAY_MS).toISOString().slice(0, 10);
  return { from: day(min), to: day(max) };
}
