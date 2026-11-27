import { exponent } from './currencies.js';

export function checkRate(rate) {
  if (typeof rate !== 'string' || !/^\d+(\.\d+)?$/.test(rate) || Number(rate) === 0) {
    throw new RangeError(`invalid rate: ${rate}`);
  }
  return rate;
}

const RATE_SCALE = 100_000_000n; // rates carry 8 decimals

export function convert(amount, from, to, rate) {
  if (typeof amount !== 'bigint') throw new TypeError('amount must be a bigint');
  checkRate(rate);
  const scaled = BigInt(Math.round(Number(rate) * 1e8));
  const num = amount * scaled * 10n ** BigInt(exponent(to));
  const den = RATE_SCALE * 10n ** BigInt(exponent(from));
  return (num + den / 2n) / den; // round half up
}
