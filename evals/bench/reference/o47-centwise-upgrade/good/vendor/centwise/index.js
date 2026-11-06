// centwise 3.0.0: integer-cent money helpers.

export const version = '3.0.0';

const MODES = new Set(['half-up', 'half-even', 'down']);
const SCALE = 10n ** 10n;
const SYMBOLS = { EUR: '€', GBP: '£', USD: '$' };

export class CentwiseParseError extends Error {
  constructor(input) {
    super(`centwise: not an amount: ${JSON.stringify(input)}`);
    this.name = 'CentwiseParseError';
    this.input = input;
  }
}

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
 * @param {{ rounding?: 'half-up' | 'half-even' | 'down' }} [options] default 'half-even'
 */
export function multiply(cents, factor, { rounding = 'half-even' } = {}) {
  return roundDiv(BigInt(cents) * ratio(factor), SCALE, rounding);
}

/**
 * `pct` percent of an amount in cents (percent(2000, 21) === 420).
 * @param {number} cents
 * @param {number} pct
 * @param {{ rounding?: 'half-up' | 'half-even' | 'down' }} [options] default 'half-even'
 */
export function percent(cents, pct, { rounding = 'half-even' } = {}) {
  return roundDiv(BigInt(cents) * ratio(pct), SCALE * 100n, rounding);
}

/** A decimal amount (number or numeric string, e.g. 19.99 or "19.99") to cents, rounded half up to the cent. */
export function fromDecimal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new TypeError(`centwise: not a decimal amount: ${value}`);
  return roundDiv(ratio(n) * 100n, SCALE, 'half-up');
}

function parseAmount(input) {
  const s = String(input ?? '').replace(/€/g, '').replace(/\s+/g, '');
  const m = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '0').padEnd(2, '0'));
  return m[1] ? -cents : cents;
}

/**
 * Parse an amount typed by a person ("12.50", "12,50", "€ 12.50", "-3") to cents.
 * @param {string} input
 * @returns {number}
 * @throws {CentwiseParseError} when the input is not an amount
 */
export function parse(input) {
  const cents = parseAmount(input);
  if (cents === null) throw new CentwiseParseError(input);
  return cents;
}

/**
 * Like `parse`, but returns null when the input is not an amount.
 * @param {string} input
 * @returns {number | null}
 */
export function tryParse(input) {
  return parseAmount(input);
}

/**
 * Format cents for display: format(1250, { currency: 'EUR' }) === '€12.50'.
 * @param {number} cents
 * @param {{ currency: 'EUR' | 'GBP' | 'USD' }} options
 */
export function format(cents, { currency } = {}) {
  if (currency === undefined) throw new TypeError('centwise: format() needs a currency option');
  const symbol = SYMBOLS[currency];
  if (!symbol) throw new RangeError(`centwise: unknown currency "${currency}"`);
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${symbol}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
