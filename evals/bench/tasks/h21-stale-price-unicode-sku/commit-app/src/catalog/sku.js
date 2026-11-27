// SKUs are case-insensitive and surrounding whitespace is ignored.
// Accents ARE significant: "CAFÉ-CRÈME-250" and "CAFE-CREME-250" are two
// different supplier lines. NFC keeps "É" typed on a keyboard and "E" + U+0301
// coming from the supplier ERP as the same SKU.

export function canonicalSku(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new TypeError('sku must be a non-empty string');
  return raw.normalize('NFC').trim().toUpperCase();
}
