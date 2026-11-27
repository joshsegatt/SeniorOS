import { systemClock } from './clock.js';
import { initialState, refill, msUntil, encode, decode } from './tokenBucket.js';

export class RateLimitError extends Error {
  constructor(key, retryAfterMs) {
    super(`rate limit for "${key}" would need a wait of ${retryAfterMs}ms`);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

// Token-bucket rate limiter whose state lives in a shared store, so every
// instance (pod) talking to the same store shares one budget per key.
export function createRateLimiter({ store, clock = systemClock, capacity, ratePerSec, prefix = 'rl:' }) {
  if (!(capacity > 0) || !(ratePerSec > 0)) throw new Error('capacity and ratePerSec must be positive');
  const config = { capacity, ratePerSec };

  async function tryTake(key, n = 1) {
    if (n > capacity) throw new Error(`cannot take ${n} tokens from a bucket of ${capacity}`);
    const storeKey = prefix + key;
    const now = clock.now();
    const stored = decode(await store.get(storeKey));
    const state = refill(stored ?? initialState(now, config), now, config);

    if (state.tokens >= n) {
      state.tokens -= n;
      await store.set(storeKey, encode(state));
      return { allowed: true, remaining: state.tokens, retryAfterMs: 0 };
    }

    await store.set(storeKey, encode(state));
    return { allowed: false, remaining: state.tokens, retryAfterMs: msUntil(state, n, config) };
  }

  // Waits until n tokens could be taken. Throws RateLimitError instead of
  // waiting longer than maxWaitMs.
  async function acquire(key, { n = 1, maxWaitMs = Infinity } = {}) {
    const deadline = clock.now() + maxWaitMs;
    for (;;) {
      const result = await tryTake(key, n);
      if (result.allowed) return result;
      if (clock.now() + result.retryAfterMs > deadline) throw new RateLimitError(key, result.retryAfterMs);
      await clock.sleep(result.retryAfterMs);
    }
  }

  return { tryTake, acquire };
}
