import { OutOfStockError } from './errors.js';

/** Stock levels for physical items. Digital items have no stock and are never reserved. */
export function createStock(initial = {}) {
  const levels = new Map(Object.entries(initial));

  return {
    available(sku) {
      return levels.get(sku) ?? 0;
    },
    /** All or nothing. */
    reserve(lines) {
      for (const { item, qty } of lines) {
        if (item.digital) continue;
        if ((levels.get(item.sku) ?? 0) < qty) throw new OutOfStockError(item.sku);
      }
      for (const { item, qty } of lines) {
        if (item.digital) continue;
        levels.set(item.sku, levels.get(item.sku) - qty);
      }
    },
    release(lines) {
      for (const { item, qty } of lines) {
        if (item.digital) continue;
        levels.set(item.sku, (levels.get(item.sku) ?? 0) + qty);
      }
    },
  };
}
