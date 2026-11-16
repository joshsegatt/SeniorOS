import { formatCents, sumCents } from './money.js';

let nextNumber = 4400;

export function buildInvoice(customer, lines, issuedOn) {
  if (!lines.length) throw new Error('an invoice needs at least one line');
  nextNumber += 1;
  return { number: `IN-${nextNumber}`, customer, issuedOn, lines, totalCents: sumCents(lines.map((l) => l.amountCents)) };
}

export function invoiceText(invoice) {
  const rows = invoice.lines.map((l) => `${l.description.padEnd(48)}${formatCents(l.amountCents).padStart(10)}`);
  return [`Invoice ${invoice.number} for ${invoice.customer}, ${invoice.issuedOn}`, ...rows, `${'Total'.padEnd(48)}${formatCents(invoice.totalCents).padStart(10)}`].join('\n');
}
