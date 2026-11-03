/**
 * @deprecated Use toCents from src/lib/money.js.
 * Amount in cents from user or file input.
 */
export function parseAmount(input) {
  if (typeof input === 'number') return Math.round(input * 100);
  const text = String(input ?? '').replace(/[\s€$£]/g, '').replace(',', '.');
  const value = Number(text);
  if (Number.isNaN(value)) throw new Error(`not an amount: ${input}`);
  return Math.round(value * 100);
}
