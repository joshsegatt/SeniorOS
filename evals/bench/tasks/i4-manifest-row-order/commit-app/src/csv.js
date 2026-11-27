// ADR-007: the only CSV writer in the codebase.
export function csvField(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values) {
  return values.map(csvField).join(',');
}

export function toCsv(header, rows) {
  return [csvRow(header), ...rows.map(csvRow)].join('\n') + '\n';
}
