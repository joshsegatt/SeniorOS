const AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;

export function parseChf(text) {
  const m = AMOUNT.exec(String(text).trim());
  if (!m) throw new TypeError(`invalid amount "${text}"`);
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** "2.6" -> 26 (per mille), avoids float VAT math. */
export function parsePercentToPermille(text) {
  const m = /^(\d+)(?:\.(\d))?$/.exec(String(text).trim());
  if (!m) throw new TypeError(`invalid percentage "${text}"`);
  return Number(m[1]) * 10 + Number(m[2] ?? 0);
}

export function formatChf(cents) {
  return `CHF ${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
