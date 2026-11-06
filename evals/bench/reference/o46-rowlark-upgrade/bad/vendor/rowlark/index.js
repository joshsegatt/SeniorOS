// rowlark 2.0.0: a small CSV parser and serializer (RFC 4180 quoting).

export const version = '2.0.0';

const NUMERIC = /^-?\d+(\.\d+)?$/;
const NUMBER_LIKE = /^[-+]?\d+([.,]\d+)?$/;
const FORMULA_START = /^[=+\-@\t\r]/;

function records(text, separator) {
  const out = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); out.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * Parse CSV text.
 * @param {string} text
 * @param {{ separator?: string, header?: boolean, cast?: boolean }} [options]
 */
export function parse(text, { separator = ',', header = true, cast = false } = {}) {
  const rows = records(text, separator).map((r) => (cast ? r.map((v) => (NUMERIC.test(v) ? Number(v) : v)) : r));
  if (!header) return rows;
  const [head = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((name, i) => [String(name), r[i] ?? ''])));
}

function cellText(value, escapeFormulas) {
  const s = value === null || value === undefined ? '' : String(value);
  return escapeFormulas && FORMULA_START.test(s) && !NUMBER_LIKE.test(s) ? `'${s}` : s;
}

function quote(s, separator) {
  return s.includes(separator) || s.includes('"') || s.includes('\n') || s.includes('\r') ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialize an array of objects to CSV.
 * @param {Record<string, unknown>[]} rows
 * @param {{ separator?: string, columns?: string[], header?: boolean, escapeFormulas?: boolean }} [options]
 */
export function stringify(rows, { separator = ',', columns, header = true, escapeFormulas = true } = {}) {
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const lines = rows.map((row) => cols.map((c) => quote(cellText(row[c], escapeFormulas), separator)).join(separator));
  if (header) lines.unshift(cols.map((c) => quote(String(c), separator)).join(separator));
  return lines.join('\n') + '\n';
}
