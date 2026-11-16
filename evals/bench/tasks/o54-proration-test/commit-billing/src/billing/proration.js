import { dayOfYear, daysBetween } from './dates.js';

/** Days of the period from the change day (included, it is the first day on the new plan) to the period end. */
export function daysLeft(periodEnd, changeDay) {
  return dayOfYear(periodEnd) - dayOfYear(changeDay);
}

/** Days in the billing period (28 to 31). */
export function periodDays(periodStart, periodEnd) {
  return daysBetween(periodStart, periodEnd);
}

/**
 * A mid-period plan change: credit for the unused days of the old plan, charge for the same days on the new plan.
 * Each amount is rounded to the cent on its own, so the invoice lines add up to the total.
 */
export function prorate({ oldPriceCents, newPriceCents, periodStart, periodEnd, changeDay }) {
  const total = periodDays(periodStart, periodEnd);
  const left = daysLeft(periodEnd, changeDay);
  const credit = Math.round((oldPriceCents * left) / total);
  const charge = Math.round((newPriceCents * left) / total);
  return { daysLeft: left, periodDays: total, credit, charge, net: charge - credit };
}
