/** Integer cents to a plain decimal string ("1250" -> "12.50"); `comma` uses a decimal comma ("12,50"). */
export function centsToDecimal(cents, { comma = false } = {}) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const text = `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return comma ? text.replace('.', ',') : text;
}
