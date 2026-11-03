/**
 * @typedef {import('./inventory.js').StockItem & { low: boolean }} ReportItem
 * @typedef {{ generatedAt: string, items: ReportItem[], lowStock: number }} StockReport
 */

/** @param {ReportItem} a @param {ReportItem} b */
const bySkuThenWarehouse = (a, b) => a.sku.localeCompare(b.sku) || a.warehouse.localeCompare(b.warehouse);

/**
 * The stock report: every item with its low-stock flag (qty at or below the reorder point).
 * @param {import('./inventory.js').StockItem[]} inventory
 * @param {{ now?: () => Date }} [options]
 * @returns {StockReport}
 */
export function stockReport(inventory, { now = () => new Date() } = {}) {
  const items = inventory.map((i) => ({ ...i, low: i.qty <= i.reorderAt })).sort(bySkuThenWarehouse);
  return { generatedAt: now().toISOString(), items, lowStock: items.filter((i) => i.low).length };
}

/**
 * Plain-text version for the terminal.
 * @param {StockReport} report
 */
export function formatReport(report) {
  const lines = report.items.map((i) => `${i.low ? '!' : ' '} ${i.sku.padEnd(10)} ${i.warehouse} ${String(i.qty).padStart(4)}`);
  return [...lines, `${report.lowStock} item(s) at or below the reorder point`].join('\n');
}
