// Token bucket math. State is { tokens, updatedAt } (updatedAt in ms).
// The bucket holds at most `capacity` tokens and gains `ratePerSec` tokens per second.
// Tokens are fractional: rounding them down on every refill would throw away
// the partial token each time and starve steady traffic.

export function initialState(now, { capacity }) {
  return { tokens: capacity, updatedAt: now };
}

export function refill(state, now, { capacity, ratePerSec }) {
  // Instances' clocks disagree. A caller whose clock is behind the last update
  // gets no refill, and updatedAt never moves backwards; otherwise the next
  // caller would be refilled for the same interval a second time.
  if (now <= state.updatedAt) return { tokens: state.tokens, updatedAt: state.updatedAt };
  const added = ((now - state.updatedAt) / 1000) * ratePerSec;
  return { tokens: Math.min(capacity, state.tokens + added), updatedAt: now };
}

// Milliseconds until `n` tokens are available, given the (already refilled) state.
export function msUntil(state, n, { ratePerSec }) {
  if (state.tokens >= n) return 0;
  return Math.ceil(((n - state.tokens) / ratePerSec) * 1000);
}

export function encode(state) {
  return JSON.stringify(state);
}

export function decode(raw) {
  return raw === null || raw === undefined ? null : JSON.parse(raw);
}
