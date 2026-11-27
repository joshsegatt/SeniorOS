const PATTERNS = {
  'DD.MM.YYYY': /^(?<d>\d{2})\.(?<m>\d{2})\.(?<y>\d{4})$/,
  'MM/DD/YYYY': /^(?<m>\d{2})\/(?<d>\d{2})\/(?<y>\d{4})$/,
  'YYYY-MM-DD': /^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$/,
};

// Returns an ISO date string (YYYY-MM-DD) or throws.
export function parseDate(raw, format) {
  const pattern = PATTERNS[format];
  if (!pattern) throw new Error(`unknown date format ${format}`);
  const match = pattern.exec(String(raw).trim());
  if (!match) throw new Error(`date "${raw}" does not match ${format}`);
  const { y, m, d } = match.groups;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) {
    throw new Error(`date "${raw}" is not a real day`);
  }
  return `${y}-${m}-${d}`;
}
