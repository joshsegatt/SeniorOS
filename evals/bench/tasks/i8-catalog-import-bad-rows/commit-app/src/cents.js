// "12", "12.5", "12.50" -> integer cents. Anything else -> null.
export function toCents(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const [, units, decimals = ''] = match;
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}
