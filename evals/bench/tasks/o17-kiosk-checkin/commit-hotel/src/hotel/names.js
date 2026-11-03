/**
 * A guest name as we store it.
 * @param {unknown} value
 */
export function cleanName(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}
