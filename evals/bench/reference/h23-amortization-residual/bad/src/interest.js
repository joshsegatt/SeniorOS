import { monthlyRate } from './rate.js';

function roundHalfEven(x) {
  const floor = Math.floor(x);
  const frac = x - floor;
  if (Math.abs(frac - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(x);
}

// One month of interest on `balance` cents, rounded half to even.
export function interestFor(balance, annualRate) {
  return roundHalfEven(balance * monthlyRate(annualRate));
}
