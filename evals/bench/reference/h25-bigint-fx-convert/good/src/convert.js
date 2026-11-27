import { exponent } from './currencies.js';

// Exact rate { num, den } from a decimal string.
export function parseRate(rate) {
  if (typeof rate !== 'string' || !/^\d+(\.\d+)?$/.test(rate)) throw new RangeError(`invalid rate: ${rate}`);
  const [int, frac = ''] = rate.split('.');
  const num = BigInt(int + frac);
  if (num === 0n) throw new RangeError(`invalid rate: ${rate}`);
  return { num, den: 10n ** BigInt(frac.length) };
}

export function checkRate(rate) {
  parseRate(rate);
  return rate;
}

// Round n/d (d > 0) half to even.
export function divHalfEven(n, d) {
  let q = n / d;
  let r = n % d;
  if (r < 0n) {
    q -= 1n;
    r += d;
  }
  const twice = 2n * r;
  if (twice > d || (twice === d && q % 2n !== 0n)) q += 1n;
  return q;
}

// Convert with an exact rate { num, den }, rounding once.
export function convertExact(amount, from, to, { num, den }) {
  if (typeof amount !== 'bigint') throw new TypeError('amount must be a bigint');
  const eFrom = BigInt(exponent(from));
  const eTo = BigInt(exponent(to));
  return divHalfEven(amount * num * 10n ** eTo, den * 10n ** eFrom);
}

export function convert(amount, from, to, rate) {
  if (typeof amount !== 'bigint') throw new TypeError('amount must be a bigint');
  return convertExact(amount, from, to, parseRate(rate));
}
