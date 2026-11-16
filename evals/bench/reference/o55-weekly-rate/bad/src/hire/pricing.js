import { daysBetween } from './dates.js';

export const DAMAGE_WAIVER_PER_DAY_CENTS = 1200;

/** Hire days charged from `pickupDay` to `returnDay`. */
export function hireDays(pickupDay, returnDay) {
  const days = daysBetween(pickupDay, returnDay);
  if (days < 0) throw new Error('return day is before pickup day');
  // A same-day hire is still one day.
  return Math.max(1, days);
}

/** The price of hiring `item` from `pickupDay` to `returnDay`. The deposit is refundable and not in the total. */
export function quote(item, pickupDay, returnDay, { damageWaiver = false } = {}) {
  const days = hireDays(pickupDay, returnDay);
  const weeks = item.weeklyRateCents ? Math.floor(days / 7) : 0;
  const hireCents = weeks * (item.weeklyRateCents ?? 0) + (days - weeks * 7) * item.dailyRateCents;
  const waiverCents = damageWaiver ? days * DAMAGE_WAIVER_PER_DAY_CENTS : 0;
  return {
    itemId: item.id,
    pickupDay,
    returnDay,
    days,
    hireCents,
    waiverCents,
    totalCents: hireCents + waiverCents,
    depositCents: item.depositCents,
  };
}
