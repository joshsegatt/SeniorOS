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
//
// Taking a token is read -> compute -> compareAndSet(read value -> new value).
// If another caller (in this process or another pod) changed the bucket in
// between, the CAS fails and we decide again on fresh state, so two callers
// can never spend the same token. A denial writes nothing: refill is computed
// from updatedAt on every read, so there is nothing to persist.
export function createRateLimiter({ store, clock = systemClock, capacity, ratePerSec, prefix = 'rl:' }) {
  if (!(capacity > 0) || !(ratePerSec > 0)) throw new Error('capacity and ratePerSec must be positive');
  const config = { capacity, ratePerSec };

  async function tryTake(key, n = 1) {
    if (n > capacity) throw new Error(`cannot take ${n} tokens from a bucket of ${capacity}`);
    const storeKey = prefix + key;
    for (;;) {
      const now = clock.now();
      const raw = await store.get(storeKey);
      const stored = decode(raw);
      const state = refill(stored ?? initialState(now, config), now, config);

      if (state.tokens < n) {
        // If our clock is behind the last update, the refill starts from there.
        const behind = Math.max(0, state.updatedAt - now);
        return { allowed: false, remaining: state.tokens, retryAfterMs: behind + msUntil(state, n, config) };
      }

      const next = { tokens: state.tokens - n, updatedAt: state.updatedAt };
      if (await store.compareAndSet(storeKey, raw, encode(next))) {
        return { allowed: true, remaining: next.tokens, retryAfterMs: 0 };
      }
    }
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
