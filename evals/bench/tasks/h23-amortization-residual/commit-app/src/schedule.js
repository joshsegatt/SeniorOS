import { interestFor } from './interest.js';
import { levelPayment } from './payment.js';

function checkInput({ principal, months }) {
  if (!Number.isSafeInteger(principal) || principal <= 0) {
    throw new RangeError(`principal must be a positive integer number of cents: ${principal}`);
  }
  if (!Number.isInteger(months) || months <= 0) {
    throw new RangeError(`months must be a positive integer: ${months}`);
  }
}

export function buildSchedule({ principal, annualRate, months, rateChanges = [] }) {
  checkInput({ principal, months });
  const changes = new Map(rateChanges.map((c) => [c.month, c.annualRate]));
  let rate = changes.get(1) ?? annualRate;
  let balance = principal;
  let payment = levelPayment(balance, rate, months);
  const rows = [];
  for (let month = 1; month <= months; month++) {
    if (month > 1 && changes.has(month)) {
      rate = changes.get(month);
      payment = levelPayment(balance, rate, months - month);
    }
    const interest = interestFor(balance, rate);
    const pay = month === months ? balance + interest : payment;
    const principalPart = pay - interest;
    balance -= principalPart;
    rows.push({
      month,
      payment: Math.round(pay),
      interest: Math.round(interest),
      principal: Math.round(principalPart),
      balance: Math.max(0, Math.round(balance)),
    });
  }
  return rows;
}
