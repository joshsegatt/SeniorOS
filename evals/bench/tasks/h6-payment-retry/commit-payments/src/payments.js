import { orderTotal } from './orders.js';

/**
 * @typedef {{ id: string, lines: import('./orders.js').OrderLine[], region: 'CH' | 'DE' | 'US', cardToken: string }} Order
 */

/**
 * Charges the customer for an order and returns the PayCo charge id.
 * @param {Order} order
 * @param {import('../vendor/payco.js').PayCoClient} gateway
 * @returns {Promise<string>}
 */
export async function chargeOrder(order, gateway) {
  const amountCents = orderTotal(order.lines, order.region);
  const charge = await gateway.charge({ amountCents, currency: 'CHF', card: order.cardToken });
  return charge.id;
}
