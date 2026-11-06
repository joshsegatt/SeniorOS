import { toCents } from './units.js';

/**
 * @typedef {{ sku: string, title: string, priceCents: number, weightKg: number, hsCode?: string,
 *   originCountry?: string, active: boolean, updatedAt?: string }} Product
 */

/**
 * Turns a saved product record into the shape the code uses. Saved records are never rewritten in place, so a
 * record can be in any shape an earlier version of the admin or the import saved: upgrade old shapes here.
 * @param {Record<string, any>} raw
 * @returns {Product}
 */
export function readProduct(raw) {
  const { price, ...rest } = raw;
  // Saved before March 2025: `price` was the euro string typed in the admin form.
  const priceCents = raw.priceCents ?? toCents(price);
  return { ...rest, priceCents, active: raw.active !== false };
}
