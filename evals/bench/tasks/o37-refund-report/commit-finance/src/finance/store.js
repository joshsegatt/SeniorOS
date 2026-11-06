/**
 * In-memory payments store (production uses the same interface over Postgres).
 * @typedef {{ id: string, orderId: string, customerId: string, amountCents: number, providerChargeId: string, capturedAt: string }} Payment
 * @typedef {{ id: string, paymentId: string, orderId: string, customerId: string, source: string, createdAt: string, [field: string]: unknown }} Refund
 */
export function createPaymentsStore() {
  /** @type {Payment[]} */
  const payments = [];
  /** @type {Refund[]} */
  const refunds = [];
  let seq = 1000;
  return {
    /** @param {string} prefix */
    nextId(prefix) {
      seq += 1;
      return `${prefix}-${seq}`;
    },
    /** @param {Payment} payment */
    insertPayment(payment) {
      payments.push({ ...payment });
      return { ...payment };
    },
    /** @param {string} id */
    getPayment(id) {
      const found = payments.find((p) => p.id === id);
      return found ? { ...found } : null;
    },
    /** @param {string} chargeId */
    findPaymentByCharge(chargeId) {
      const found = payments.find((p) => p.providerChargeId === chargeId);
      return found ? { ...found } : null;
    },
    payments() {
      return payments.map((p) => ({ ...p }));
    },
    /** @param {Refund} refund */
    insertRefund(refund) {
      refunds.push({ ...refund });
      return { ...refund };
    },
    /** @param {string} paymentId */
    refundsFor(paymentId) {
      return refunds.filter((r) => r.paymentId === paymentId).map((r) => ({ ...r }));
    },
    refunds() {
      return refunds.map((r) => ({ ...r }));
    },
  };
}
