/** @deprecated Use createEvents from src/lib/events.js. */
export function createBus() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    emit(type, payload) {
      for (const fn of [...(handlers.get(type) ?? [])]) fn(payload);
    },
  };
}
