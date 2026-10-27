// formatting helpers
export function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export function formatPercent(x) {
  return `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
}

const CURRENCY_SYMBOLS = { EUR: '€', USD: '$' };

export function formatCurrency(cents, currency) {
  const symbol = CURRENCY_SYMBOLS[currency];
  if (symbol === undefined) throw new Error(`Unsupported currency: ${currency}`);
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${symbol}${units}.${fraction}`;
}
