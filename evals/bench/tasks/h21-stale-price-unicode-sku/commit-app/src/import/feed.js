import { parseChf, parsePercentToPermille } from '../format/money.js';

// Nightly supplier feed: semicolon separated, header
// sku;name;price_chf;vat_pct  (price is net).

export function parseFeed(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  const [header, ...rows] = lines;
  if (header?.trim() !== 'sku;name;price_chf;vat_pct') throw new SyntaxError('unexpected feed header');
  return rows.map((line, i) => {
    const cols = line.split(';');
    if (cols.length !== 4) throw new SyntaxError(`feed line ${i + 2}: expected 4 columns`);
    const [sku, name, price, vat] = cols;
    return { sku, name: name.trim(), netCents: parseChf(price), vatPermille: parsePercentToPermille(vat) };
  });
}

export function importFeed(app, text) {
  const rows = parseFeed(text);
  for (const row of rows) {
    const product = app.catalog.upsert(row);
    app.prices.invalidate(product.sku);
  }
  return rows.length;
}
