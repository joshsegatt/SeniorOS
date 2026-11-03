export class BillingUnavailable extends Error {
  constructor(cause) {
    super('billing service unavailable', { cause });
    this.name = 'BillingUnavailable';
  }
}

export const deny = (status, error) => ({ status, body: { error } });

/** Wraps an async handler: known failures become responses, the rest is rethrown. */
export function handler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof BillingUnavailable) return { status: 503, body: { error: 'billing_unavailable' } };
      throw err;
    }
  };
}
