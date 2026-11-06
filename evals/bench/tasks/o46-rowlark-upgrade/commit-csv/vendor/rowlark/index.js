// rowlark 1.8.0: a small CSV parser and serializer (RFC 4180 quoting).

const NUMERIC = /^-?\d+(\.\d+)?$/;

function records(text, delimiter) {
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
    else if (ch === delimiter) { row.push(cell); cell = ''; }
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
 * @param {{ delimiter?: string, header?: boolean, cast?: boolean }} [options]
 */
function parse(text, { delimiter = ',', header = true, cast = true } = {}) {
  const rows = records(text, delimiter).map((r) => (cast ? r.map((v) => (NUMERIC.test(v) ? Number(v) : v)) : r));
  if (!header) return rows;
  const [head = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((name, i) => [String(name), r[i] ?? ''])));
}

function quote(value, delimiter) {
  const s = value === null || value === undefined ? '' : String(value);
  return s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r') ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialize an array of objects to CSV.
 * @param {Record<string, unknown>[]} rows
 * @param {{ delimiter?: string, columns?: string[], header?: boolean }} [options]
 */
function stringify(rows, { delimiter = ',', columns, header = true } = {}) {
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const lines = rows.map((row) => cols.map((c) => quote(row[c], delimiter)).join(delimiter));
  if (header) lines.unshift(cols.map((c) => quote(c, delimiter)).join(delimiter));
  return lines.join('\n') + '\n';
}

export default { version: '1.8.0', parse, stringify };
