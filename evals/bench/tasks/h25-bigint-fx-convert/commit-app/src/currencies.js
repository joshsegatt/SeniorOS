// ISO 4217 minor-unit exponents.
const EXPONENTS = { USD: 2, EUR: 2, CHF: 2, GBP: 2, JPY: 0, KWD: 3, BHD: 3, CLF: 4 };

export function exponent(currency) {
  if (!Object.hasOwn(EXPONENTS, currency)) throw new RangeError(`unknown currency: ${currency}`);
  return EXPONENTS[currency];
}
