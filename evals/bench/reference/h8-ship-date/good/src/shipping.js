/** Orders at or above this subtotal ship for free, in cents. */
export const FREE_SHIPPING_THRESHOLD = 5000;
export const STANDARD_SHIPPING = 790;

/** @param {number} subtotalCents */
export function shippingCost(subtotalCents) {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
}

/** Orders placed before this hour (Zurich time) ship the same business day. */
export const SAME_DAY_CUTOFF_HOUR = 14;

// Zurich wall-clock parts, independent of the server's time zone (production runs in UTC) and DST-aware.
const zurich = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Zurich',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
});

/**
 * The day an order ships, as YYYY-MM-DD in Zurich. Before 14:00 Zurich time it ships that day,
 * otherwise the next business day; never on a Saturday or Sunday.
 * @param {Date} orderedAt
 */
export function shipDate(orderedAt) {
  const parts = Object.fromEntries(zurich.formatToParts(orderedAt).map((p) => [p.type, p.value]));
  // Calendar arithmetic on a UTC date that carries the Zurich calendar day: no DST or server-zone effects.
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (Number(parts.hour) >= SAME_DAY_CUTOFF_HOUR) day.setUTCDate(day.getUTCDate() + 1);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}
