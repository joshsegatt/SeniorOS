import { exponent } from './currencies.js';

export function parseMoney(text, currency) {
  const e = exponent(currency);
  const m = typeof text === 'string' ? /^(-?)(\d+)(?:\.(\d+))?$/.exec(text) : null;
  if (!m) throw new RangeError(`invalid amount: ${text}`);
  const [, sign, int, frac = ''] = m;
  if (frac.length > e) throw new RangeError(`${currency} has ${e} decimals: ${text}`);
  const value = BigInt(int + frac.padEnd(e, '0'));
  return sign ? -value : value;
}

export function formatMinor(amount, currency) {
  if (typeof amount !== 'bigint') throw new TypeError('amount must be a bigint');
  const e = exponent(currency);
  const digits = (amount < 0n ? -amount : amount).toString().padStart(e + 1, '0');
  const int = digits.slice(0, digits.length - e).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = e > 0 ? `.${digits.slice(digits.length - e)}` : '';
  return `${amount < 0n ? '-' : ''}${int}${frac}`;
}
