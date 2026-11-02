import { orderTotal } from './orders.js';

/**
 * @typedef {{ id: string, status: 'placed' | 'cancelled', region: 'CH' | 'DE' | 'US',
 *   lines: import('./orders.js').OrderLine[], totalCents: number, chargeId: string }} Order
 */

/**
 * Placing and looking up orders.
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
        const order = { id, status: 'placed', region, lines, totalCents, chargeId };
        orders.set(id, order);
        return order;
      } catch (err) {
        for (const line of taken) stock.putBack(line.sku, line.qty);
        throw err;
      }
    },

    /** @param {string} id */
    async cancelOrder(id) {
      const order = orders.get(id);
      if (!order) throw new Error(`no order ${id}`);
      if (order.status === 'cancelled') return order;
      await gateway.refund(order.chargeId, order.totalCents);
      for (const line of order.lines) stock.putBack(line.sku, line.qty);
      order.status = 'cancelled';
      return order;
    },

    /** @param {string} id */
    getOrder(id) {
      return orders.get(id);
    },
  };
}
