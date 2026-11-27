// Stub with the contract of docs/payment-gateway.md. `captures` lists real captures.
export function createGatewayStub({ declineAll = false } = {}) {
  const captures = [];
  const byKey = new Map();
  return {
    captures,
    async charge({ amountCents, currency, customerId, idempotencyKey }) {
      if (declineAll) throw Object.assign(new Error('card declined'), { code: 'CARD_DECLINED' });
      if (idempotencyKey && byKey.has(idempotencyKey)) return { chargeId: byKey.get(idempotencyKey) };
      const chargeId = `ch_${captures.length + 1}`;
      captures.push({ chargeId, amountCents, currency, customerId, idempotencyKey });
      if (idempotencyKey) byKey.set(idempotencyKey, chargeId);
      return { chargeId };
    },
  };
}
