// Formats integer minor units as "1234.56" (or "-0.05").
export function formatMinor(minor) {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function formatTotals(totals) {
  const lines = [];
  for (const month of Object.keys(totals).sort()) {
    for (const currency of Object.keys(totals[month]).sort()) {
      lines.push(`${month}  ${currency}  ${formatMinor(totals[month][currency])}`);
    }
  }
  return lines.join('\n');
}
