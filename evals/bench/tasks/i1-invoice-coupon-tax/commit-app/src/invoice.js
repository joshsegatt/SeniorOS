import { sumCents } from './money.js';
import { rateFor, taxOn } from './tax.js';
import { discountFor } from './discounts.js';

function buildLine(line, rateBp) {
  if (!Number.isInteger(line.qty) || line.qty <= 0) throw new RangeError(`bad qty for ${line.sku}`);
  if (!Number.isInteger(line.unitCents) || line.unitCents < 0) {
    throw new RangeError(`bad unit price for ${line.sku}`);
  }
  const totalCents = line.qty * line.unitCents;
  return {
    sku: line.sku,
    description: line.description ?? line.sku,
    qty: line.qty,
    unitCents: line.unitCents,
    totalCents,
    // Per-line tax for the new PDF layout.
    taxCents: taxOn(totalCents, rateBp),
  };
}

/**
 * Builds an invoice. See docs/invoicing.md for the rules.
 * @param {{ customer: { id: string, country: string }, lines: Array<{ sku: string, qty: number, unitCents: number, description?: string }>, coupon?: object | null }} input
 */
export function buildInvoice({ customer, lines, coupon = null }) {
  if (!customer || !customer.country) throw new TypeError('customer.country is required');
  if (!Array.isArray(lines) || lines.length === 0) throw new TypeError('an invoice needs at least one line');

  const rateBp = rateFor(customer.country);
  const invoiceLines = lines.map((line) => buildLine(line, rateBp));
  const subtotalCents = sumCents(invoiceLines.map((line) => line.totalCents));
  const discountCents = discountFor(subtotalCents, coupon);
  const taxableCents = subtotalCents - discountCents;
  const taxCents = sumCents(invoiceLines.map((line) => line.taxCents));

  return {
    customerId: customer.id,
    country: customer.country,
    rateBp,
    lines: invoiceLines,
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}
