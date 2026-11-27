import { exponent } from './currencies.js';

export function parseMoney(text, currency) {
  const e = exponent(currency);
  if (typeof text !== 'string' || !/^-?\d+(\.\d+)?$/.test(text)) throw new RangeError(`invalid amount: ${text}`);
  const decimals = (text.split('.')[1] ?? '').length;
  if (decimals > e) throw new RangeError(`${currency} has ${e} decimals: ${text}`);
  return BigInt(Math.round(Number(text) * 10 ** e));
}

export function formatMinor(amount, currency) {
  const e = exponent(currency);
  const value = Number(amount) / 10 ** e;
  return value.toLocaleString('en-US', { minimumFractionDigits: e, maximumFractionDigits: e });
}
