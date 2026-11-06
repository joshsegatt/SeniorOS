import { format } from '../../vendor/centwise/index.js';
import { vatFor } from './tax.js';

/**
 * Build an invoice from order lines. VAT is computed per line, then summed.
 * @param {{ number: string, lines: { description: string, quantity: number, unitCents: number, vat?: 'standard' | 'reduced' | 'zero' }[] }} order
 */
export function buildInvoice(order) {
  const lines = order.lines.map((l) => {
    const netCents = l.unitCents * l.quantity;
    const vatCents = vatFor(netCents, l.vat ?? 'standard');
    return { description: l.description, quantity: l.quantity, netCents, vatCents, net: format(netCents) };
  });
  const netCents = lines.reduce((s, l) => s + l.netCents, 0);
  const vatCents = lines.reduce((s, l) => s + l.vatCents, 0);
  return {
    number: order.number,
    lines,
    netCents,
    vatCents,
    totalCents: netCents + vatCents,
    totals: { net: format(netCents), vat: format(vatCents), total: format(netCents + vatCents) },
  };
}
