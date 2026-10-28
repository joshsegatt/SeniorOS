// Grader's own Ledgerly double (the repo's test/support copy may have been edited by the run).
import { LedgerlyError } from '../../src/accounting/ledgerly.js';

const MAX_IN_FLIGHT = 4;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createLedgerlyDouble({ latencyMs = () => 2, failing = [] } = {}) {
  const received = new Map();
  const failingIds = new Set(failing);
  const stats = { requests: 0, maxInFlight: 0, tooManyRequests: 0, duplicates: 0 };
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
        if (received.has(order.orderId)) {
          stats.duplicates += 1;
          throw new LedgerlyError(409, `order ${order.orderId} already exists`);
        }
        received.set(order.orderId, order);
        return { ledgerId: `L-${order.orderId}` };
      } finally {
        inFlight -= 1;
      }
    },
  };
}

/**
 * A checkpoint that records a violation whenever it is moved past an order Ledgerly does not have yet
 * (a crash right after such a write would skip that order forever).
 */
export function createWatchedCheckpoint(ledgerly, ids, initial = 0) {
  let value = initial;
  const violations = [];
  return {
    violations,
    async get() {
      return value;
    },
    async set(id) {
      const missing = ids.filter((x) => x <= id && !ledgerly.received.has(x));
      if (missing.length) violations.push(`checkpoint set to ${id} while order(s) ${missing.join(', ')} not in Ledgerly`);
      value = id;
    },
  };
}
