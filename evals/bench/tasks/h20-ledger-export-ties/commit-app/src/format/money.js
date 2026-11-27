// Money is kept in integer cents everywhere. Never parse amounts with parseFloat.

const AMOUNT = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

export function parseAmount(text) {
  const m = AMOUNT.exec(String(text).trim());
  if (!m) throw new TypeError(`invalid amount "${text}"`);
  const [, sign, whole, frac = ''] = m;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return sign && cents !== 0 ? -cents : cents;
}

export function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function isoDate(epochSeconds) {
  return new Date(epochSeconds * 1000).toISOString().replace('.000Z', 'Z');
}
