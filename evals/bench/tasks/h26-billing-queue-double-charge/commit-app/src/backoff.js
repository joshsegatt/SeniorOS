// Exponential backoff: 1st failed attempt waits baseMs, 2nd 2*baseMs, ... capped at maxMs.
export function backoffDelay(failedAttempt, { baseMs = 1000, maxMs = 60_000 } = {}) {
  return Math.min(maxMs, baseMs * 2 ** (failedAttempt - 1));
}
