// Integer-cent helpers. Amounts are always integer cents.

/** Rounds numerator / denominator to the nearest integer, ties away from zero. */
export function roundHalfUp(numerator, denominator) {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new TypeError('roundHalfUp expects integers and a positive denominator');
  }
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  return sign * Math.floor((abs * 2 + denominator) / (denominator * 2));
}

export function sumCents(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function displayAmount(cents, currency = 'CHF') {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${currency} ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
