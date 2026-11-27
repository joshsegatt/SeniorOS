// Clock abstraction so the queue can be driven by a fake clock in tests.
// A clock has now(), setTimeout(fn, ms) and clearTimeout(handle).

export const systemClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle),
};

// Deterministic clock for tests. advance(ms) fires due timers in order and lets
// pending promise callbacks run between them.
export function createFakeClock(start = 0) {
  let now = start;
  let nextId = 1;
  const timers = new Map();
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, ms), fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    pendingTimers: () => timers.size,
    async advance(ms) {
      const target = now + ms;
      await settle();
      for (;;) {
        let dueId = null;
        let due = null;
        for (const [id, timer] of timers) {
          if (timer.at <= target && (due === null || timer.at < due.at)) {
            dueId = id;
            due = timer;
          }
        }
        if (due === null) break;
        timers.delete(dueId);
        now = due.at;
        due.fn();
        await settle();
      }
      now = target;
      await settle();
    },
  };
}
