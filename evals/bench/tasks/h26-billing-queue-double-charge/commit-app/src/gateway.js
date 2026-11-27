// Payment gateway client. See docs/payment-gateway.md for the API contract.

export class GatewayError extends Error {
  constructor(message, { code = 'gateway_error', retryable = false } = {}) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function createHttpGateway({ baseUrl, apiKey, fetchImpl = globalThis.fetch }) {
  return {
    async charge({ customerId, amountCents, currency, idempotencyKey }) {
      let res;
      try {
        res = await fetchImpl(`${baseUrl}/v1/charges`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            'idempotency-key': idempotencyKey,
          },
          body: JSON.stringify({ customer: customerId, amount: amountCents, currency }),
        });
      } catch (err) {
        throw new GatewayError(`network error: ${err.message}`, { code: 'network', retryable: true });
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        throw new GatewayError('a request with this idempotency key is in progress', {
          code: 'idempotency_in_progress',
          retryable: true,
        });
      }
      if (!res.ok) {
        throw new GatewayError(body.message ?? `HTTP ${res.status}`, {
          code: body.code ?? 'gateway_error',
          retryable: res.status >= 500,
        });
      }
      return { id: body.id, amountCents: body.amount, customerId: body.customer };
    },
  };
}
