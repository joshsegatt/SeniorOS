/**
 * @typedef {import('./inventory.js').StockItem & { low: boolean }} ReportItem
 * @typedef {{ id: string, items: ReportItem[], lowStock: number }} WarehouseStock
 * @typedef {{ generatedAt: string, warehouses: WarehouseStock[] }} StockReport
 */

/**
 * The stock report, grouped by warehouse: each item with its low-stock flag (qty at or below the reorder point).
 * @param {import('./inventory.js').StockItem[]} inventory
 * @param {{ now?: () => Date }} [options]
 * @returns {StockReport}
 */
export function stockReport(inventory, { now = () => new Date() } = {}) {
  /** @type {Map<string, WarehouseStock>} */
  const groups = new Map();
  for (const i of inventory) {
    const group = groups.get(i.warehouse) ?? { id: i.warehouse, items: [], lowStock: 0 };
    const item = { ...i, low: i.qty <= i.reorderAt };
    group.items.push(item);
    if (item.low) group.lowStock += 1;
    groups.set(i.warehouse, group);
  }
  const warehouses = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const w of warehouses) w.items.sort((a, b) => a.sku.localeCompare(b.sku));
  return { generatedAt: now().toISOString(), warehouses };
}

/**
 * Plain-text version for the terminal, one section per warehouse.
 * @param {StockReport} report
 */
export function formatReport(report) {
  const out = [];
  let total = 0;
  for (const w of report.warehouses) {
    out.push(`${w.id}`);
    for (const i of w.items) out.push(`${i.low ? '!' : ' '} ${i.sku.padEnd(10)} ${String(i.qty).padStart(4)}`);
    total += w.lowStock;
  }
  out.push(`${total} item(s) at or below the reorder point`);
  return out.join('\n');
}
