// Tiny in-process event bus. Handlers run one after another in registration
// order; a failing handler is recorded in `errors` and does not stop the others.

export function createBus() {
  const listeners = new Map(); // event -> fn[]
  const errors = [];

  function off(event, fn) {
    const list = listeners.get(event);
    if (!list) return false;
    const i = list.indexOf(fn);
    if (i === -1) return false;
    list.splice(i, 1);
    return true;
  }

  return {
    errors,

    /** Registers fn for event and returns a function that unregisters it.
     *  Registering the same function twice for an event is a no-op. */
    on(event, fn) {
      if (typeof fn !== 'function') throw new TypeError('handler must be a function');
      if (!listeners.has(event)) listeners.set(event, []);
      const list = listeners.get(event);
      if (!list.includes(fn)) list.push(fn);
      return () => off(event, fn);
    },

    off,

    removeAllListeners(event) {
      listeners.delete(event);
    },

    listenerCount(event) {
      return listeners.get(event)?.length ?? 0;
    },

    async emit(event, payload) {
      for (const fn of [...(listeners.get(event) ?? [])]) {
        try {
          await fn(payload);
        } catch (err) {
          errors.push({ event, error: err });
        }
      }
    },
  };
}
