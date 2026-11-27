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
  let rate = annualRate;
  let balance = principal;
  let payment = 0;
  const rows = [];
  for (let month = 1; month <= months; month++) {
    if (month === 1 || changes.has(month)) {
      if (changes.has(month)) rate = changes.get(month);
      payment = levelPayment(balance, rate, months - month + 1);
    }
    const interest = interestFor(balance, rate);
    const last = month === months || balance + interest <= payment;
    const pay = last ? balance + interest : payment;
    const principalPart = pay - interest;
    balance -= principalPart;
    rows.push({ month, payment: pay, interest, principal: principalPart, balance });
    if (last) break;
  }
  return rows;
}
