import { monthlyRate, divHalfEven } from './rate.js';

// One month of interest on `balance` cents, rounded half to even.
export function interestFor(balance, annualRate) {
  const { num, den } = monthlyRate(annualRate);
  return Number(divHalfEven(BigInt(balance) * num, den));
}
