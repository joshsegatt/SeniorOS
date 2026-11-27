import { taxOn } from './tax.js';

/** Reverses an invoice. Must cancel it to the cent (docs/invoicing.md rule 9). */
export function creditNoteFor(invoice, reason = 'cancellation') {
  const taxableCents = -invoice.taxableCents;
  const taxCents = -taxOn(invoice.taxableCents, invoice.rateBp);
  return {
    customerId: invoice.customerId,
    country: invoice.country,
    reason,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}
