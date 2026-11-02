// PayGate client, v3.2.0. Vendored copy: do not edit, upgrade it as a whole.
//
// charge(orderId, cents)                 -> { chargeId }
// refund(chargeId, cents, options?)      -> { refundId }
//
// A refund moves real money back to the customer. PayGate does not stop a second refund of the same charge: each
// call refunds again.
//
// A timeout (PayGateTimeout) means the refund may or may not have happened: the call can fail before PayGate gets it
// or after PayGate already refunded. Pass `{ idempotencyKey }` to refund: PayGate performs at most one refund per key,
// and a retry with the key of a refund that went through returns that refund instead of refunding again. A declined
// refund is not recorded, so it can be retried with the same key. A retry of a refund that timed out must use the
// same key, or the customer may be refunded twice.
//
// Production code gets a client from `connect(apiKey)`. Tests use `createFakeGateway()`, with the same behavior.

export class PayGateTimeout extends Error {}

/**
 * @typedef {{
 *   charge(orderId: string, cents: number): Promise<{ chargeId: string }>,
 *   refund(chargeId: string, cents: number, options?: { idempotencyKey?: string }): Promise<{ refundId: string }>,
 * }} PayGate
 */

/**
 * In-process gateway for tests. `failNext(kind)` makes the next refund fail: 'declined' (nothing refunded),
 * 'lost' (timed out before PayGate got it: nothing refunded, the caller gets a PayGateTimeout) or 'timeout'
 * (refunded on PayGate's side, but the caller gets a PayGateTimeout).
 */
export function createFakeGateway() {
  const charges = new Map();
  const byKey = new Map();
  let failure = null;
  let seq = 0;
  const roundTrip = () => new Promise((resolve) => setImmediate(resolve));
  return {
    async charge(orderId, cents) {
      await roundTrip();
      const chargeId = `ch_${++seq}`;
      charges.set(chargeId, { orderId, cents, refunded: 0 });
      return { chargeId };
    },
    async refund(chargeId, cents, options = {}) {
      await roundTrip();
      const charge = charges.get(chargeId);
      if (!charge) throw new Error(`PayGate: unknown charge ${chargeId}`);
      const key = options.idempotencyKey;
      if (key && byKey.has(key)) return byKey.get(key);
      const kind = failure;
      failure = null;
      if (kind === 'declined') throw new Error('PayGate: refund declined');
      if (kind === 'lost') throw new PayGateTimeout('PayGate: timed out');
      charge.refunded += cents;
      const result = { refundId: `re_${++seq}` };
      if (key) byKey.set(key, result);
      if (kind === 'timeout') throw new PayGateTimeout('PayGate: timed out');
      return result;
    },
    /** @param {'declined' | 'lost' | 'timeout'} kind */
    failNext(kind) {
      failure = kind;
    },
    /** Total refunded for a charge (test helper). @param {string} chargeId */
    refundedFor(chargeId) {
      return charges.get(chargeId)?.refunded ?? 0;
    },
  };
}

/** @param {string} apiKey @returns {PayGate} */
export function connect(apiKey) {
  const call = async (op, body) => {
    const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
    if (body.idempotencyKey) headers['idempotency-key'] = body.idempotencyKey;
    const res = await fetch(`https://api.paygate.example/v3/${op}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.status === 504) throw new PayGateTimeout(`PayGate ${op} timed out`);
    if (!res.ok) throw new Error(`PayGate ${op} failed: ${res.status}`);
    return res.json();
  };
  return {
    charge: (orderId, cents) => call('charges', { orderId, cents }),
    refund: (chargeId, cents, options = {}) => call('refunds', { chargeId, cents, idempotencyKey: options.idempotencyKey }),
  };
}
