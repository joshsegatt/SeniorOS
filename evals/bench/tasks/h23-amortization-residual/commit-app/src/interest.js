import { monthlyRate } from './rate.js';

// One month of interest on `balance` cents.
export function interestFor(balance, annualRate) {
  return balance * monthlyRate(annualRate);
}
