// Test double for the Ledgerly API: same limits as the real service (see src/accounting/ledgerly.js).
import { LedgerlyError } from '../../src/accounting/ledgerly.js';

const MAX_IN_FLIGHT = 4;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {{ latencyMs?: (orderId: number) => number, failing?: Iterable<number> }} [options]
 */
export function createFakeLedgerly({ latencyMs = () => 1, failing = [] } = {}) {
  /** @type {Map<number, any>} */
  const received = new Map();
  const failingIds = new Set(failing);
  const stats = { requests: 0, maxInFlight: 0, tooManyRequests: 0 };
  let inFlight = 0;
  return {
    received,
    failing: failingIds,
    stats,
    async uploadOrder(order) {
      stats.requests += 1;
      inFlight += 1;
      stats.maxInFlight = Math.max(stats.maxInFlight, inFlight);
      try {
        if (inFlight > MAX_IN_FLIGHT) {
          stats.tooManyRequests += 1;
          throw new LedgerlyError(429, 'too many requests in flight');
        }
        await sleep(latencyMs(order.orderId));
        if (failingIds.has(order.orderId)) throw new LedgerlyError(503, `upload of order ${order.orderId} failed`);
        if (received.has(order.orderId)) throw new LedgerlyError(409, `order ${order.orderId} already exists`);
        received.set(order.orderId, order);
        return { ledgerId: `L-${order.orderId}` };
      } finally {
        inFlight -= 1;
      }
    },
  };
}
