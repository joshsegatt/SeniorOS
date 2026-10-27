import { randomUUID } from 'node:crypto';
import { GatewayTimeoutError, GatewayUnavailableError } from '../vendor/payco.js';
import { orderTotal } from './orders.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 50;

/**
 * @typedef {{ id: string, lines: import('./orders.js').OrderLine[], region: 'CH' | 'DE' | 'US', cardToken: string }} Order
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Errors where trying again can succeed. Safe only because every attempt reuses one idempotency key. */
function isTransient(err) {
  return err instanceof GatewayTimeoutError || err instanceof GatewayUnavailableError;
}

/**
 * Charges the customer for an order and returns the PayCo charge id.
 * A timeout may have charged the card, so all attempts share one idempotency key:
 * PayCo processes it at most once and replays the original result.
 * @param {Order} order
 * @param {import('../vendor/payco.js').PayCoClient} gateway
 * @returns {Promise<string>}
 */
export async function chargeOrder(order, gateway) {
  const amountCents = orderTotal(order.lines, order.region);
  const request = { amountCents, currency: 'CHF', card: order.cardToken, idempotencyKey: `order-${order.id}-${randomUUID()}` };
  for (let attempt = 1; ; attempt += 1) {
    try {
      const charge = await gateway.charge(request);
      return charge.id;
    } catch (err) {
      if (!isTransient(err) || attempt >= MAX_ATTEMPTS) throw err;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}
