/**
 * Orders of the shop, kept in memory and loaded from the nightly snapshot.
 * @typedef {{ sku: string, qty: number, priceCents: number }} OrderLine
 * @typedef {{ id: string, customerId: string, placedAt: string, totalCents: number, balanceCents: number,
 *             status: 'open' | 'paid' | 'cancelled', lines: OrderLine[] }} Order
 */

/** @param {Order} a @param {Order} b */
const byPlacedAt = (a, b) => a.placedAt.localeCompare(b.placedAt) || a.id.localeCompare(b.id);

/** @param {Order[]} seed */
export function createOrderStore(seed = []) {
  /** @type {Order[]} */
  const orders = seed.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l })) }));

  /**
   * A customer's orders by date.
   * @param {string} customerId
   * @param {{ offset?: number, limit?: number }} [page]
   */
  function ordersFor(customerId, { offset = 0, limit = Infinity } = {}) {
    return orders
      .filter((o) => o.customerId === customerId)
      .sort(byPlacedAt)
      .slice(offset, offset + limit);
  }

  /** @param {string} customerId */
  function countFor(customerId) {
    return orders.filter((o) => o.customerId === customerId).length;
  }

  /** Orders that still have something to pay. @param {string} customerId */
  function openOrders(customerId) {
    return ordersFor(customerId).filter((o) => o.status === 'open' && o.balanceCents > 0);
  }

  /** @param {string} id @param {Partial<Order>} patch */
  function update(id, patch) {
    const order = orders.find((o) => o.id === id);
    if (!order) throw new Error(`unknown order ${id}`);
    Object.assign(order, patch);
    return order;
  }

  return { ordersFor, countFor, openOrders, update };
}
