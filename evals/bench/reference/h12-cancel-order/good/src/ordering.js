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
  /** Cancels in progress, so a second call joins the first instead of refunding again. */
  const cancelling = new Map();

  /** @param {Order} order */
  async function cancel(order) {
    // The key makes a retry after a timeout return the first refund instead of refunding again.
    await gateway.refund(order.chargeId, order.totalCents, { idempotencyKey: `cancel:${order.id}` });
    for (const line of order.lines) stock.putBack(line.sku, line.qty);
    order.status = 'cancelled';
  }

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

    /**
     * Refunds the customer, puts the items back in stock and marks the order cancelled. A failed refund leaves the
     * order placed so it can be cancelled again; cancelling a cancelled order does nothing.
     * @param {string} id
     */
    async cancelOrder(id) {
      const order = orders.get(id);
      if (!order) throw new Error(`no order ${id}`);
      if (order.status === 'cancelled') return order;
      if (!cancelling.has(id)) cancelling.set(id, cancel(order).finally(() => cancelling.delete(id)));
      await cancelling.get(id);
      return order;
    },

    /** @param {string} id */
    getOrder(id) {
      return orders.get(id);
    },
  };
}
