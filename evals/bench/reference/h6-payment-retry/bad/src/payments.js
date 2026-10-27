import { GatewayTimeoutError, GatewayUnavailableError } from '../vendor/payco.js';
import { orderTotal } from './orders.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 50;

/**
 * @typedef {{ id: string, lines: import('./orders.js').OrderLine[], region: 'CH' | 'DE' | 'US', cardToken: string }} Order
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Charges the customer for an order and returns the PayCo charge id.
 * Retries timeouts and 503s with a short backoff, up to 3 attempts.
 * @param {Order} order
 * @param {import('../vendor/payco.js').PayCoClient} gateway
 * @returns {Promise<string>}
 */
export async function chargeOrder(order, gateway) {
  const amountCents = orderTotal(order.lines, order.region);
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const charge = await gateway.charge({ amountCents, currency: 'CHF', card: order.cardToken });
      return charge.id;
    } catch (err) {
      lastError = err;
      const retryable = err instanceof GatewayTimeoutError || err instanceof GatewayUnavailableError;
      if (!retryable) throw err;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}
