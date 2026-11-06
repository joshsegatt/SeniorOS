import { priceItems } from '../catalog.js';

/**
 * @typedef {{ sku: string, name: string, qty: number, unitCents: number, totalCents: number }} Line
 * @typedef {{ id: string, customerId: string, lines: Line[], totalCents: number, status: 'pending' | 'paid' | 'declined' | 'failed',
 *   chargeId: string | null, refundedCents: number, createdAt: string }} Order
 */

export function createOrderStore() {
  /** @type {Map<string, Order>} */
  const orders = new Map();
  /** Refund amounts being sent to the provider, per order. @type {Map<string, number>} */
  const refundsInFlight = new Map();
  let seq = 70400;
  return {
    nextId() {
      seq += 1;
      return `o-${seq}`;
    },
    /** @param {Order} order */
    async insert(order) {
      orders.set(order.id, structuredClone(order));
      return structuredClone(order);
    },
    /** @param {string} id */
    async get(id) {
      const o = orders.get(id);
      return o ? structuredClone(o) : null;
    },
    /** @param {string} id @param {Partial<Order>} changes */
    async update(id, changes) {
      const o = orders.get(id);
      if (!o) throw new Error(`unknown order ${id}`);
      Object.assign(o, changes);
      return structuredClone(o);
    },
    async all() {
      return [...orders.values()].map((o) => structuredClone(o));
    },
    /**
     * Reserve part of an order's charge for a refund, atomically: two refunds sent at the same moment can never add
     * up to more than was charged. Returns false when the amount is not available.
     * @param {string} id @param {number} amountCents
     */
    reserveRefund(id, amountCents) {
      const o = orders.get(id);
      if (!o) return false;
      const reserved = refundsInFlight.get(id) ?? 0;
      if (o.refundedCents + reserved + amountCents > o.totalCents) return false;
      refundsInFlight.set(id, reserved + amountCents);
      return true;
    },
    /** @param {string} id @param {number} amountCents @param {boolean} sent the provider made the refund */
    settleRefund(id, amountCents, sent) {
      refundsInFlight.set(id, (refundsInFlight.get(id) ?? 0) - amountCents);
      const o = orders.get(id);
      if (o && sent) o.refundedCents += amountCents;
    },
  };
}

/**
 * Create a pending order from the basket the app sent.
 * @param {{ orders: ReturnType<typeof createOrderStore>, catalog: Map<string, import('../catalog.js').Product> }} deps
 * @param {{ customerId: string, items: { sku: string, qty: number }[] }} input
 * @param {() => Date} [now]
 */
export async function createOrder(deps, input, now = () => new Date()) {
  if (!input.customerId) throw new Error('customerId is required');
  const { lines, totalCents } = priceItems(deps.catalog, input.items);
  return deps.orders.insert({
    id: deps.orders.nextId(),
    customerId: input.customerId,
    lines,
    totalCents,
    status: 'pending',
    chargeId: null,
    refundedCents: 0,
    createdAt: now().toISOString(),
  });
}
