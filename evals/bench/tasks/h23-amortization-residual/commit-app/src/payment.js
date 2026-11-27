import { monthlyRate } from './rate.js';

// Level annuity payment (cents, rounded up) repaying `balance` over `n` months.
export function levelPayment(balance, annualRate, n) {
  const r = monthlyRate(annualRate);
  return Math.ceil((balance * r) / (1 - (1 + r) ** -n));
}
