import { priceWithTax } from '../pricing.js';

/**
 * @typedef {{ id: string, sku: string, priceCents: number, qty: number }} Line
 * @typedef {{
 *   id: string, customerId: string, region: 'CH' | 'DE' | 'US', lines: Line[],
 *   subtotalCents: number, discountCents: number, totalCents: number,
 *   paymentId: string, refundedCents: number, status: 'paid' | 'partially_refunded' | 'refunded'
 * }} Order
 */

export class BillingError extends Error {}

/**
 * Order totals: an optional percent coupon on the whole subtotal, then tax on what is left.
 * @param {Line[]} lines @param {'CH' | 'DE' | 'US'} region @param {number} [couponPercent]
 */
export function priceOrder(lines, region, couponPercent = 0) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
  const discountCents = Math.round((subtotalCents * couponPercent) / 100);
  const totalCents = priceWithTax(subtotalCents - discountCents, region);
  return { subtotalCents, discountCents, totalCents };
}

/** @param {{ gateway: ReturnType<typeof import('./gateway.js').createMemoryGateway> }} deps */
export function createBillingService({ gateway }) {
  /** @type {Map<string, Order>} */
  const orders = new Map();
  let next = 1001;

  /** @param {string} orderId */
  function find(orderId) {
    const order = orders.get(orderId);
    if (!order) throw new BillingError(`unknown order ${orderId}`);
    return order;
  }

  return {
    /**
     * @param {{ customerId: string, region: 'CH' | 'DE' | 'US', couponPercent?: number,
     *           lines: { sku: string, priceCents: number, qty: number }[] }} input
     */
    async placeOrder({ customerId, region, couponPercent = 0, lines }) {
      if (!lines.length) throw new BillingError('an order needs at least one line');
      const withIds = lines.map((l, i) => ({ id: `L${i + 1}`, ...l }));
      const totals = priceOrder(withIds, region, couponPercent);
      const paymentId = await gateway.charge(totals.totalCents);
      /** @type {Order} */
      const order = { id: `o-${next++}`, customerId, region, lines: withIds, ...totals, paymentId, refundedCents: 0, status: 'paid' };
      orders.set(order.id, order);
      return structuredClone(order);
    },

    /** @param {string} orderId */
    getOrder(orderId) {
      return structuredClone(find(orderId));
    },

    /** Refunds whatever has not been refunded yet. @param {string} orderId */
    async refundOrder(orderId) {
      const order = find(orderId);
      const left = order.totalCents - order.refundedCents;
      if (left <= 0) throw new BillingError(`order ${orderId} is already refunded`);
      await gateway.refund(order.paymentId, left);
      order.refundedCents += left;
      order.status = 'refunded';
      return left;
    },
  };
}
