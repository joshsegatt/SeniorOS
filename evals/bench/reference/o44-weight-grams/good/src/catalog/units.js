/** "14.90", "14,90" or 14.9 -> 1490. Returns NaN for anything that is not a number. @param {string | number} euros */
export function toCents(euros) {
  return Math.round(Number(String(euros).trim().replace(',', '.')) * 100);
}

/** "0.42", "0,42" or 0.42 -> 0.42 (kilograms). Returns NaN for anything that is not a number. @param {string | number} kg */
export function parseKg(kg) {
  return Number(String(kg).trim().replace(',', '.'));
}

/** Kilograms as typed ("0.42", "0,42", 0.42) -> integer grams (420). NaN for anything that is not a number. @param {string | number} kg */
export function kgToGrams(kg) {
  return Math.round(parseKg(kg) * 1000);
}

/** 1490 -> "14.90". @param {number} cents */
export function formatAmount(cents) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
