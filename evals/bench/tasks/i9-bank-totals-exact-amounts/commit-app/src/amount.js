// Parses an exported amount string into a number of currency units.
// TODO: per-source formats (docs/sources.md); only plain "1234.50" works today.
export function parseAmount(raw, source) {
  return Number(String(raw).trim());
}
