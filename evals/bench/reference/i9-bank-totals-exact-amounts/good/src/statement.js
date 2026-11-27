import { getSource } from './sources.js';
import { parseDate } from './dates.js';
import { parseAmount } from './amount.js';

// { source, rows } -> [{ source, date, month, currency, text, amountMinor }]
// amountMinor is an integer number of cents / Rappen.
export function normalizeStatement({ source: sourceId, rows }) {
  const source = getSource(sourceId);
  return rows.map((row, index) => {
    try {
      const date = parseDate(row.date, source.dateFormat);
      return {
        source: source.id,
        date,
        month: date.slice(0, 7),
        currency: source.currency,
        text: row.text ?? '',
        amountMinor: parseAmount(row.amount, source),
      };
    } catch (err) {
      throw new Error(`${source.id} row ${index}: ${err.message}`, { cause: err });
    }
  });
}
