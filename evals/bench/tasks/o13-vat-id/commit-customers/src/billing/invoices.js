/**
 * Invoices. Once issued, an invoice never changes: the customer's billing details are copied into it.
 * @typedef {{ description: string, qty: number, unitCents: number }} Line
 * @typedef {{ number: string, issuedAt: string, customerId: string, billTo: { name: string, email: string }, lines: Line[], totalCents: number }} Invoice
 * @param {{ repo: ReturnType<import('../customers/repo.js').createCustomerRepo>, now?: () => Date }} deps
 */
export function createInvoicing({ repo, now = () => new Date() }) {
  /** @type {Invoice[]} */
  const invoices = [];

  /** @param {string} customerId @param {Line[]} lines */
  function issue(customerId, lines) {
    const customer = repo.get(customerId);
    if (!customer) throw new Error(`unknown customer ${customerId}`);
    if (lines.length === 0) throw new Error('an invoice needs at least one line');
    const invoice = {
      number: `INV-${String(invoices.length + 1).padStart(4, '0')}`,
      issuedAt: now().toISOString(),
      customerId,
      billTo: { name: customer.name, email: customer.email },
      lines: lines.map((l) => ({ ...l })),
      totalCents: lines.reduce((sum, l) => sum + l.qty * l.unitCents, 0),
    };
    invoices.push(invoice);
    return structuredClone(invoice);
  }

  /** Plain-text invoice (email body and PDF text). @param {string} number */
  function render(number) {
    const inv = invoices.find((i) => i.number === number);
    if (!inv) throw new Error(`unknown invoice ${number}`);
    const money = (/** @type {number} */ c) => (c / 100).toFixed(2);
    return [
      `Invoice ${inv.number}`,
      `Date: ${inv.issuedAt.slice(0, 10)}`,
      '',
      'Bill to:',
      `  ${inv.billTo.name}`,
      `  ${inv.billTo.email}`,
      '',
      ...inv.lines.map((l) => `${String(l.qty).padStart(3)} x ${l.description.padEnd(30)} ${money(l.qty * l.unitCents).padStart(10)}`),
      '',
      `${'Total EUR'.padEnd(36)} ${money(inv.totalCents).padStart(10)}`,
    ].join('\n');
  }

  return { issue, render };
}
