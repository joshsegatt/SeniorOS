// centwise 2.4.1: integer-cent money helpers.

export const version = '2.4.1';

const MODES = new Set(['half-up', 'half-even', 'down']);
const SCALE = 10n ** 10n;
const SYMBOLS = { EUR: '€', GBP: '£', USD: '$' };

function ratio(factor) {
  if (!Number.isFinite(factor)) throw new TypeError(`centwise: not a finite factor: ${factor}`);
  return BigInt(Number(factor).toFixed(10).replace('.', ''));
}

function roundDiv(num, den, mode) {
  if (!MODES.has(mode)) throw new RangeError(`centwise: unknown rounding mode "${mode}"`);
  const neg = num < 0n;
  const n = neg ? -num : num;
  let q = n / den;
  const twice = (n % den) * 2n;
  if (mode !== 'down' && (twice > den || (twice === den && (mode === 'half-up' || q % 2n === 1n)))) q += 1n;
  return Number(neg ? -q : q);
}

/**
 * Multiply an amount in cents by a factor, rounding to whole cents.
 * @param {number} cents
 * @param {number} factor
 * @param {{ rounding?: 'half-up' | 'half-even' | 'down' }} [options] default 'half-up'
 */
export function multiply(cents, factor, { rounding = 'half-up' } = {}) {
  return roundDiv(BigInt(cents) * ratio(factor), SCALE, rounding);
}

/**
 * `pct` percent of an amount in cents (percentOf(2000, 21) === 420).
 * @param {number} cents
 * @param {number} pct
 * @param {{ rounding?: 'half-up' | 'half-even' | 'down' }} [options] default 'half-up'
 */
export function percentOf(cents, pct, { rounding = 'half-up' } = {}) {
  return roundDiv(BigInt(cents) * ratio(pct), SCALE * 100n, rounding);
}

/** A decimal amount (number or numeric string, e.g. 12.5 or "12.50") to cents. */
export function fromDecimal(value) {
  return Math.trunc(Number(value) * 100);
}

/**
 * Parse an amount typed by a person ("12.50", "12,50", "€ 12.50", "-3") to cents.
 * @param {string} input
 * @returns {number | null} null when the input is not an amount
 */
export function parse(input) {
  const s = String(input ?? '').replace(/€/g, '').replace(/\s+/g, '');
  const m = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '0').padEnd(2, '0'));
  return m[1] ? -cents : cents;
}

/**
 * Format cents for display: format(1250) === '€12.50'.
 * @param {number} cents
 * @param {{ currency?: 'EUR' | 'GBP' | 'USD' }} [options] default 'EUR'
 */
export function format(cents, { currency = 'EUR' } = {}) {
  const symbol = SYMBOLS[currency];
  if (!symbol) throw new RangeError(`centwise: unknown currency "${currency}"`);
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${symbol}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
