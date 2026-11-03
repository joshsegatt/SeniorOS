import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** @typedef {{ sku: string, name: string, warehouse: string, qty: number, reorderAt: number }} StockItem */

export const DEFAULT_INVENTORY = fileURLToPath(new URL('../../data/inventory.json', import.meta.url));

/**
 * @param {string} [file]
 * @returns {StockItem[]}
 */
export function loadInventory(file = DEFAULT_INVENTORY) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
