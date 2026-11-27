// Pushes order events to the ERP (and any other configured endpoint).

export function postWebhook(cfg, http, event) {
  return async (order) => {
    for (const url of cfg.webhooks.urls) {
      await http.post(url, { event, orderId: order.id, totalCents: order.totalCents });
    }
  };
}

// In-memory HTTP client that records requests; the production adapter wraps
// fetch with the same post(url, body) API.
export function createRecordingHttp() {
  const requests = [];
  return {
    async post(url, body) {
      requests.push({ method: 'POST', url, body: structuredClone(body) });
      return { status: 202 };
    },
    requests() {
      return requests.map((r) => ({ ...r }));
    },
  };
}
