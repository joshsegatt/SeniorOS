// A clock has now() (ms) and sleep(ms). Injected so tests can drive time.
export const systemClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Manual clock for tests: time only moves when the test calls set/advance.
// sleep() resolves when the clock reaches the wake-up time.
export function createManualClock(start = 0) {
  let now = start;
  let sleepers = [];
  const wake = () => {
    const due = sleepers.filter((s) => s.at <= now);
    sleepers = sleepers.filter((s) => s.at > now);
    for (const s of due) s.resolve();
  };
  return {
    now: () => now,
    sleep(ms) {
      return new Promise((resolve) => {
        sleepers.push({ at: now + Math.max(0, ms), resolve });
        wake();
      });
    },
    set(t) {
      now = t;
      wake();
    },
    advance(ms) {
      now += ms;
      wake();
    },
  };
}
