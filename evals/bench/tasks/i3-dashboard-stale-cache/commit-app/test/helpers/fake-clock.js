export function fakeClock(iso) {
  let now = Date.parse(iso);
  return {
    now: () => now,
    advance(ms) {
      now += ms;
    },
  };
}
