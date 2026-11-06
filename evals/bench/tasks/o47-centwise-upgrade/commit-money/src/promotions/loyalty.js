import { multiply } from '../../vendor/centwise/index.js';

/** Loyalty points: one point per euro spent, partial euros never earn a point. */
export function pointsFor(totalCents) {
  if (totalCents <= 0) return 0;
  return multiply(totalCents, 0.01, { rounding: 'down' });
}
