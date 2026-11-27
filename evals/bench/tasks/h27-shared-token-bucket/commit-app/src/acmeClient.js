// Client for the Acme partner API. Every request goes through the shared
// limiter so all pods together stay under Acme's per-account limit.

export function createAcmeClient({ baseUrl, token, limiter, fetchImpl = globalThis.fetch, maxWaitMs = 10_000 }) {
  async function request(path, init = {}) {
    await limiter.acquire('acme', { maxWaitMs });
    const res = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
    });
    if (res.status === 429) {
      const err = new Error('Acme answered 429 Too Many Requests');
      err.status = 429;
      throw err;
    }
    if (!res.ok) throw new Error(`Acme ${path} failed: HTTP ${res.status}`);
    return res.json();
  }

  return {
    getOrder: (id) => request(`/orders/${encodeURIComponent(id)}`),
    pushShipment: (shipment) => request('/shipments', { method: 'POST', body: JSON.stringify(shipment) }),
  };
}
