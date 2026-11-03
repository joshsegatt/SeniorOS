import { round2, toEur } from '../fx/convert.js';

/**
 * The EUR figures we book for an invoice issued in another currency (the tax office wants the
 * reference rate of the invoice date).
 * @param {ReturnType<import('../fx/rates.js').createRatesClient>} rates
 * @param {{ number: string, date: string, currency: string, lines: { description: string, amount: number }[] }} invoice
 */
export async function invoiceInEur(rates, invoice) {
  const total = round2(invoice.lines.reduce((sum, l) => sum + l.amount, 0));
  return { number: invoice.number, date: invoice.date, currency: invoice.currency, total, totalEur: await toEur(rates, total, invoice.currency, invoice.date) };
}
