import { monthlyRate, divCeil } from './rate.js';

// Level annuity payment (cents, rounded up) repaying `balance` over `n` months.
// With r = num/den: B * num * (den+num)^n / (den * ((den+num)^n - den^n)).
export function levelPayment(balance, annualRate, n) {
  const { num, den } = monthlyRate(annualRate);
  const b = BigInt(balance);
  const months = BigInt(n);
  if (num === 0n) return Number(divCeil(b, months));
  const grown = (den + num) ** months;
  const base = den ** months;
  return Number(divCeil(b * num * grown, den * (grown - base)));
}
