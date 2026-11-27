// RFC 4180 CSV writer: fields containing a comma, quote, CR or LF are quoted
// and embedded quotes are doubled. Lines end with \r\n (Excel expects it).

function field(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header, rows) {
  const lines = [header.map(field).join(',')];
  for (const row of rows) lines.push(row.map(field).join(','));
  return lines.join('\r\n') + '\r\n';
}
