// PayCo card gateway SDK, v2.3.1. Vendored copy: do not edit, upgrade it as a whole.
//
// const payco = createPayCoClient({ apiKey, fetch });
// const charge = await payco.charge({ amountCents, currency, card, idempotencyKey });
//
// Idempotency: requests that carry the same `idempotencyKey` are processed at most once
// within 24 hours. Repeating a request with a key PayCo has already processed returns the
// original result instead of charging again. Requests without a key are always processed.
//
// Errors thrown by `charge`:
// - GatewayTimeoutError: PayCo did not answer in time. The charge may or may not have been made.
// - GatewayUnavailableError: PayCo answered 503. The request was not processed.
// - CardDeclinedError: the card was declined. Final for this card.

export class GatewayTimeoutError extends Error {
  constructor(message = 'PayCo did not answer in time') {
    super(message);
    this.name = 'GatewayTimeoutError';
    this.code = 'TIMEOUT';
  }
}

export class GatewayUnavailableError extends Error {
  constructor(message = 'PayCo is unavailable (503)') {
    super(message);
    this.name = 'GatewayUnavailableError';
    this.code = 'UNAVAILABLE';
  }
}

export class CardDeclinedError extends Error {
  constructor(message = 'The card was declined') {
    super(message);
    this.name = 'CardDeclinedError';
    this.code = 'CARD_DECLINED';
  }
}

/**
 * @typedef {{ amountCents: number, currency: string, card: string, idempotencyKey?: string }} ChargeRequest
 * @typedef {{ id: string, amountCents: number, currency: string }} Charge
 * @typedef {{ charge(request: ChargeRequest): Promise<Charge> }} PayCoClient
 */

/**
 * @param {{ apiKey: string, fetch: typeof globalThis.fetch, baseUrl?: string, timeoutMs?: number }} options
 * @returns {PayCoClient}
 */
export function createPayCoClient({ apiKey, fetch, baseUrl = 'https://api.payco.example/v2', timeoutMs = 8000 }) {
  return {
    async charge({ amountCents, currency, card, idempotencyKey }) {
      const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
      if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
      let res;
      try {
        res = await fetch(`${baseUrl}/charges`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ amount: amountCents, currency, source: card }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (err && err.name === 'TimeoutError') throw new GatewayTimeoutError();
        throw err;
      }
      if (res.status === 503) throw new GatewayUnavailableError();
      const body = await res.json();
      if (res.status === 402) throw new CardDeclinedError(body.message);
      if (!res.ok) throw new Error(`PayCo error ${res.status}: ${body.message ?? 'unknown'}`);
      return { id: body.id, amountCents: body.amount, currency: body.currency };
    },
  };
}
