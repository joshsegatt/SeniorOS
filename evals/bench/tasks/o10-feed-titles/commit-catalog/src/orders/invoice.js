/**
 * Plain-text invoice (sent as the email body and stored as the PDF's text layer).
 * @param {{ id: string, lines: { sku: string, qty: number }[] }} order
 * @param {ReturnType<import('../catalog/store.js').createCatalog>} catalog
 */
export function invoiceText(order, catalog) {
  let total = 0;
  const rows = order.lines.map((line) => {
    const p = catalog.get(line.sku);
    if (!p) throw new Error(`unknown product ${line.sku}`);
    const amount = p.priceCents * line.qty;
    total += amount;
    return `${String(line.qty).padStart(3)} x ${p.name.padEnd(40)} ${(amount / 100).toFixed(2).padStart(10)}`;
  });
  return [`Invoice ${order.id}`, '', ...rows, '', `${'Total'.padEnd(46)} ${(total / 100).toFixed(2).padStart(10)} EUR`].join('\n');
}
