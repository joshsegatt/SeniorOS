/**
 * "03.10.2026" -> "2026-10-03".
 * @param {unknown} text
 */
export function parseSwissDate(text) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(text ?? '').trim());
  if (!m) throw new Error(`invalid date ${JSON.stringify(text)}`);
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw new Error(`invalid date ${JSON.stringify(text)}`);
  return iso;
}

/** "2026-10-03" -> "03.10.2026". @param {string} iso */
export function formatSwissDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
