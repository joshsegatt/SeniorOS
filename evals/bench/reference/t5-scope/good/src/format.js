// formatting helpers
export function formatDate(d) {
  var y = d.getUTCFullYear(); var m = d.getUTCMonth() + 1; var day = d.getUTCDate()
  if (m < 10) { m = '0' + m } if (day < 10) { day = '0' + day }
  return y + '-' + m + '-' + day
}

export function formatPercent(x) {
  var s = (Math.round(x * 1000) / 10).toString()
  if (s.indexOf('.') == -1) { s = s + '.0' }
  return s + '%'
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
