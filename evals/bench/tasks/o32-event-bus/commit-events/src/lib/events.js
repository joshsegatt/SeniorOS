/** Domain events. `publish` resolves once every subscriber has finished. */
export function createEvents({ log = (message, err) => console.error(message, err) } = {}) {
  const subscribers = new Map();
  return {
    subscribe(type, fn) {
      if (!subscribers.has(type)) subscribers.set(type, new Set());
      subscribers.get(type).add(fn);
      return () => subscribers.get(type).delete(fn);
    },
    async publish(type, payload) {
      const fns = [...(subscribers.get(type) ?? [])];
      const results = await Promise.allSettled(fns.map(async (fn) => fn(payload)));
      for (const r of results) if (r.status === 'rejected') log(`subscriber of ${type} failed`, r.reason);
    },
  };
}
