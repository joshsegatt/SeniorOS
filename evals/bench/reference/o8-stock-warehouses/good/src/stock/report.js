/**
 * @typedef {import('./inventory.js').StockItem & { low: boolean }} ReportItem
 * @typedef {{ id: string, items: ReportItem[], lowStock: number }} WarehouseStock
 * @typedef {{ generatedAt: string, warehouses: WarehouseStock[], items: ReportItem[], lowStock: number }} StockReport
 *   `items` and `lowStock` (all warehouses together) are kept for the reorder bot and the dashboard tile, which read
 *   this report's JSON.
 */

/** @param {ReportItem} a @param {ReportItem} b */
const bySkuThenWarehouse = (a, b) => a.sku.localeCompare(b.sku) || a.warehouse.localeCompare(b.warehouse);

/**
 * The stock report: every item with its low-stock flag (qty at or below the reorder point), grouped by warehouse.
 * @param {import('./inventory.js').StockItem[]} inventory
 * @param {{ now?: () => Date }} [options]
 * @returns {StockReport}
 */
export function stockReport(inventory, { now = () => new Date() } = {}) {
  const items = inventory.map((i) => ({ ...i, low: i.qty <= i.reorderAt })).sort(bySkuThenWarehouse);
  /** @type {Map<string, WarehouseStock>} */
  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.warehouse) ?? { id: item.warehouse, items: [], lowStock: 0 };
    group.items.push(item);
    if (item.low) group.lowStock += 1;
    groups.set(item.warehouse, group);
  }
  const warehouses = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { generatedAt: now().toISOString(), warehouses, items, lowStock: items.filter((i) => i.low).length };
}

/**
 * Plain-text version for the terminal.
 * @param {StockReport} report
 */
export function formatReport(report) {
  const lines = report.items.map((i) => `${i.low ? '!' : ' '} ${i.sku.padEnd(10)} ${i.warehouse} ${String(i.qty).padStart(4)}`);
  return [...lines, `${report.lowStock} item(s) at or below the reorder point`].join('\n');
}
