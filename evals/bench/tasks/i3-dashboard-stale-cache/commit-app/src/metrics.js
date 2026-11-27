/** Aggregates ledger rows of one store and day. */
export function summarize(rows) {
  let salesCents = 0;
  let refundsCents = 0;
  let sales = 0;
  for (const row of rows) {
    if (row.type === 'sale') {
      salesCents += row.amountCents;
      sales += 1;
    } else if (row.type === 'refund') {
      refundsCents += row.amountCents;
    }
  }
  return { salesCents, refundsCents, netCents: salesCents - refundsCents, sales };
}
