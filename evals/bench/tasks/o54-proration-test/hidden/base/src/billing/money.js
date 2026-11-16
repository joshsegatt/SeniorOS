/** 3709 -> "$37.09", -1291 -> "-$12.91" */
export function formatCents(cents) {
  if (!Number.isInteger(cents)) throw new Error(`not a whole number of cents: ${cents}`);
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function sumCents(amounts) {
  return amounts.reduce((sum, a) => sum + a, 0);
}
