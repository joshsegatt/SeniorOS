/** A network round trip to the provider. */
const io = () => new Promise((resolve) => setImmediate(resolve));

export class GatewayUnavailable extends Error {}

/**
 * Fake card payment provider used in tests and local runs (production wraps the provider's HTTP API with the same
 * interface). Payment method "pm_card_declined" is always declined. Set `failNext` to make the next call fail as if
 * the provider were down.
 */
export function createFakeGateway() {
  let seq = 0;
  const gateway = {
    /** @type {{ id: string, paymentMethod: string, amountCents: number, reference: string }[]} */
    charges: [],
    /** @type {{ id: string, chargeId: string, amountCents: number }[]} */
    refunds: [],
    failNext: false,
    /**
     * @param {{ paymentMethod: string, amountCents: number, reference: string }} input
     * @returns {Promise<{ ok: true, chargeId: string } | { ok: false, reason: string }>}
     */
    async charge(input) {
      await io();
      if (gateway.failNext) {
        gateway.failNext = false;
        throw new GatewayUnavailable('provider timeout');
      }
      if (input.paymentMethod === 'pm_card_declined') return { ok: false, reason: 'card_declined' };
      seq += 1;
      const id = `ch_${seq}`;
      gateway.charges.push({ id, ...input });
      return { ok: true, chargeId: id };
    },
    /** @param {{ chargeId: string, amountCents: number }} input */
    async refund(input) {
      await io();
      if (gateway.failNext) {
        gateway.failNext = false;
        throw new GatewayUnavailable('provider timeout');
      }
      seq += 1;
      const id = `re_${seq}`;
      gateway.refunds.push({ id, ...input });
      return { refundId: id };
    },
  };
  return gateway;
}
