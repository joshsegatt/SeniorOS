import { exponent } from './currencies.js';

export function checkRate(rate) {
  if (typeof rate !== 'string' || !/^\d+(\.\d+)?$/.test(rate) || Number(rate) === 0) {
    throw new RangeError(`invalid rate: ${rate}`);
  }
  return rate;
}

export function convert(amount, from, to, rate) {
  if (typeof amount !== 'bigint') throw new TypeError('amount must be a bigint');
  checkRate(rate);
  const shift = exponent(to) - exponent(from);
  return BigInt(Math.round(Number(amount) * Number(rate) * 10 ** shift));
}
