// Token bucket math. State is { tokens, updatedAt } (updatedAt in ms).
// The bucket holds at most `capacity` tokens and gains `ratePerSec` tokens per second.

export function initialState(now, { capacity }) {
  return { tokens: capacity, updatedAt: now };
}

export function refill(state, now, { capacity, ratePerSec }) {
  const elapsedMs = now - state.updatedAt;
  const added = Math.floor((elapsedMs / 1000) * ratePerSec);
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
