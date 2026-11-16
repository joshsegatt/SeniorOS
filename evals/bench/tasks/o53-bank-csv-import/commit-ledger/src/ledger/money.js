/**
 * "-23.80" -> -2380. Exact: no floating point on the way.
 * @param {unknown} text
 */
export function parseAmount(text) {
  const value = String(text ?? '').trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!m) throw new Error(`invalid amount ${JSON.stringify(text)}`);
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -cents : cents;
}

/** 640000 -> "CHF 6'400.00" (Swiss style). @param {number} cents @param {string} [currency] */
export function formatMoney(cents, currency = 'CHF') {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const francs = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${sign}${currency} ${francs}.${String(abs % 100).padStart(2, '0')}`;
}
