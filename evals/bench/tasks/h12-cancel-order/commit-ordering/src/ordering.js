import { lineAmount, orderTotal } from './orders.js';

/**
 * @typedef {import('./orders.js').OrderLine & { returned?: boolean }} PlacedLine
 * @typedef {{ id: string, status: 'placed' | 'cancelled', region: 'CH' | 'DE' | 'US', lines: PlacedLine[],
 *   totalCents: number, refundedCents: number, chargeId: string }} Order
 */

/**
 * Placing orders, and returning items from them.
 * @param {{ gateway: import('../vendor/paygate.js').PayGate, stock: ReturnType<typeof import('./stock.js').createStock> }} deps
 */
export function createOrdering({ gateway, stock }) {
  /** @type {Map<string, Order>} */
  const orders = new Map();

  return {
    /**
     * Takes the items out of stock, charges the customer and records the order.
     * @param {string} id
     * @param {import('./orders.js').OrderLine[]} lines
     * @param {'CH' | 'DE' | 'US'} region
     */
    async placeOrder(id, lines, region) {
      if (orders.has(id)) throw new Error(`order ${id} exists`);
      const taken = [];
      try {
        for (const line of lines) {
          stock.take(line.sku, line.qty);
          taken.push(line);
        }
        const totalCents = orderTotal(lines, region);
        const { chargeId } = await gateway.charge(id, totalCents);
        /** @type {Order} */
        const order = { id, status: 'placed', region, lines: lines.map((line) => ({ ...line })), totalCents, refundedCents: 0, chargeId };
        orders.set(id, order);
        return order;
      } catch (err) {
        for (const line of taken) stock.putBack(line.sku, line.qty);
        throw err;
      }
    },

    /**
     * The customer sends one line of a placed order back: it is refunded and its items go back in stock.
     * @param {string} id
     * @param {string} sku
     */
    async returnLine(id, sku) {
      const order = orders.get(id);
      if (!order || order.status !== 'placed') throw new Error(`no placed order ${id}`);
      const line = order.lines.find((l) => l.sku === sku && !l.returned);
      if (!line) throw new Error(`no ${sku} to return in order ${id}`);
      const cents = lineAmount(line, order.region);
      await gateway.refund(order.chargeId, cents, { idempotencyKey: `return:${id}:${sku}` });
      stock.putBack(line.sku, line.qty);
      line.returned = true;
      order.refundedCents += cents;
      return order;
    },

    /** @param {string} id */
    getOrder(id) {
      return orders.get(id);
    },
  };
}
