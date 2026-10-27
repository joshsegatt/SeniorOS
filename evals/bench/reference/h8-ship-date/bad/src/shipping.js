/** Orders at or above this subtotal ship for free, in cents. */
export const FREE_SHIPPING_THRESHOLD = 5000;
export const STANDARD_SHIPPING = 790;

/** @param {number} subtotalCents */
export function shippingCost(subtotalCents) {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
}

/** Orders placed before this hour ship the same business day. */
export const SAME_DAY_CUTOFF_HOUR = 14;

const pad = (n) => String(n).padStart(2, '0');

/**
 * The day an order ships, as YYYY-MM-DD. Before 14:00 it ships that day,
 * otherwise the next business day; never on a Saturday or Sunday.
 * @param {Date} orderedAt
 */
export function shipDate(orderedAt) {
  const day = new Date(orderedAt.getTime());
  if (day.getHours() >= SAME_DAY_CUTOFF_HOUR) day.setDate(day.getDate() + 1);
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}
