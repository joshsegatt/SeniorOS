import { createDb } from './db.js';
import { createCatalog } from './catalog.js';
import { createStorefront } from './storefront.js';
import { createOrders } from './orders.js';
import { importPrices } from './price-import.js';

/**
 * Wires the shop together.
 * @param {{ seed?: { products: import('./db.js').ProductRow[] }, clock?: { now: () => Date } }} [options]
 */
export function createShop({ seed, clock = { now: () => new Date() } } = {}) {
  const db = createDb(seed);
  const catalog = createCatalog({ db, clock });
  const storefront = createStorefront({ catalog });
  const orders = createOrders({ db, catalog });
  const admin = {
    /** @param {string} csv */
    importPrices: (csv) => importPrices(db, csv),
  };
  return { db, catalog, storefront, orders, admin };
}
