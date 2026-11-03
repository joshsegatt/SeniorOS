/**
 * In-memory payment gateway with the same contract as the provider's API. Used in dev and tests;
 * production wires the HTTP client, which enforces the same rules server side.
 */

export class GatewayError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function createMemoryGateway() {
  /** @type {Map<string, { capturedCents: number, refundedCents: number, refunds: number[] }>} */
  const payments = new Map();
  let next = 1;

  return {
    /** @param {number} cents @returns {Promise<string>} payment id */
    async charge(cents) {
      if (!Number.isInteger(cents) || cents <= 0) throw new GatewayError('invalid_amount', `invalid amount: ${cents}`);
      const id = `pay_${next++}`;
      payments.set(id, { capturedCents: cents, refundedCents: 0, refunds: [] });
      return id;
    },

    /** @param {string} paymentId @param {number} cents */
    async refund(paymentId, cents) {
      const p = payments.get(paymentId);
      if (!p) throw new GatewayError('no_such_payment', `unknown payment ${paymentId}`);
      if (!Number.isInteger(cents) || cents <= 0) throw new GatewayError('invalid_amount', `invalid amount: ${cents}`);
      if (p.refundedCents + cents > p.capturedCents) {
        throw new GatewayError('amount_too_large', `refund of ${cents} exceeds the ${p.capturedCents - p.refundedCents} left on ${paymentId}`);
      }
      p.refundedCents += cents;
      p.refunds.push(cents);
    },

    /** @param {string} paymentId */
    payment(paymentId) {
      const p = payments.get(paymentId);
      return p ? { ...p, refunds: [...p.refunds] } : null;
    },
  };
}
