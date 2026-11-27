export const systemClock = Object.freeze({ now: () => Date.now() });

/** UTC calendar day (YYYY-MM-DD) of a timestamp in ms. */
export function dayOf(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
