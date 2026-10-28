/**
 * Ledgerly API client (our accounting provider).
 *
 * From Ledgerly's API terms for our plan:
 * - At most 4 requests in flight per API key. Requests beyond that are rejected with 429, and repeated 429s get
 *   the key suspended for the day.
 * - Orders are immutable in Ledgerly: uploading an order id it already has is rejected with 409.
 */

export class LedgerlyError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.name = 'LedgerlyError';
    this.status = status;
  }
}

/**
 * @typedef {{ orderId: number, totalCents: number, currency: string, placedAt: string }} LedgerlyOrder
 * @typedef {{ uploadOrder(order: LedgerlyOrder): Promise<{ ledgerId: string }> }} LedgerlyClient
 */

/**
 * @param {{ apiKey: string, baseUrl?: string }} options
 * @returns {LedgerlyClient}
 */
export function createLedgerly({ apiKey, baseUrl = 'https://api.ledgerly.example/v2' }) {
  return {
    async uploadOrder(order) {
      const res = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(order),
      });
      if (!res.ok) throw new LedgerlyError(res.status, `Ledgerly upload of order ${order.orderId} failed: ${res.status}`);
      return res.json();
    },
  };
}
