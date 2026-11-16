import { addMonths, parseDay } from './dates.js';
import { getPlan } from './plans.js';
import { prorate } from './proration.js';

/** Starts a monthly subscription on `startDay`. */
export function subscribe(id, customer, planId, startDay) {
  getPlan(planId);
  parseDay(startDay);
  return { id, customer, planId, periodStart: startDay, periodEnd: addMonths(startDay, 1) };
}

/**
 * Moves the subscription to another plan from `changeDay` on. Returns the updated subscription and the two
 * prorated invoice lines (the credit is negative).
 */
export function changePlan(sub, newPlanId, changeDay) {
  parseDay(changeDay);
  if (changeDay < sub.periodStart || changeDay >= sub.periodEnd) throw new Error('change day outside the current period');
  if (newPlanId === sub.planId) throw new Error('already on this plan');
  const oldPlan = getPlan(sub.planId);
  const newPlan = getPlan(newPlanId);
  const p = prorate({ oldPriceCents: oldPlan.priceCents, newPriceCents: newPlan.priceCents, periodStart: sub.periodStart, periodEnd: sub.periodEnd, changeDay });
  const span = `${p.daysLeft} of ${p.periodDays} days`;
  return {
    subscription: { ...sub, planId: newPlanId },
    lines: [
      { description: `Unused time on ${oldPlan.name} (${span})`, amountCents: -p.credit },
      { description: `Remaining time on ${newPlan.name} (${span})`, amountCents: p.charge },
    ],
  };
}

/** The next period, billed in full at the current plan's price. */
export function renew(sub) {
  const plan = getPlan(sub.planId);
  const next = { ...sub, periodStart: sub.periodEnd, periodEnd: addMonths(sub.periodEnd, 1) };
  return { subscription: next, lines: [{ description: `${plan.name} plan (${next.periodStart} to ${next.periodEnd})`, amountCents: plan.priceCents }] };
}
