// Money helpers. All amounts are integer cents (see .senior/decisions.md).

/**
 * Percentage of an amount in cents, rounded half to even (banker's rounding).
 * @param {number} cents
 * @param {number} percent
 */
export function percentOf(cents, percent) {
  const exact = (cents * percent) / 100;
  const floor = Math.floor(exact);
  if (Math.abs(exact - floor - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(exact);
}

/** @param {number} cents */
export function formatCHF(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}CHF ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
