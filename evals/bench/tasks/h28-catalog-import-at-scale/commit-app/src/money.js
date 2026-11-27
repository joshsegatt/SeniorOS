// "19.9" -> 1990, "7" -> 700. At most two decimals, no sign, no thousands separators.
// Returns null when the text is not a valid price.
export function parsePriceCents(text) {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

export function formatCents(cents, currency) {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}
