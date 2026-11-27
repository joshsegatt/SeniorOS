import { sumCents } from './money.js';

/** Monthly statement: what the customer owes for the documents of the month. */
export function statementFor(customerId, documents) {
  const own = documents.filter((doc) => doc.customerId === customerId);
  return {
    customerId,
    documentCount: own.length,
    totalCents: sumCents(own.map((doc) => doc.totalCents)),
  };
}

/** VAT report per country for the quarterly filing (docs/invoicing.md rule 10). */
export function vatReport(documents) {
  const report = {};
  for (const doc of documents) {
    const row = (report[doc.country] ??= { taxableCents: 0, taxCents: 0 });
    row.taxableCents += doc.taxableCents;
    row.taxCents += doc.taxCents;
  }
  return report;
}
