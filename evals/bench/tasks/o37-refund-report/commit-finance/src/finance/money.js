/** "37.85" or 37.85 -> 3785. @param {string | number} euros */
export function toCents(euros) {
  return Math.round(Number(euros) * 100);
}

/** 124000 -> "€1,240.00". @param {number} cents */
export function formatEuros(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}€${whole}.${String(abs % 100).padStart(2, '0')}`;
}
